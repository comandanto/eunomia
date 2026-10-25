#![cfg(test)]
use crate::{EunomiaPolicy, EunomiaPolicyClient};
use soroban_sdk::{
    contract, contractimpl,
    testutils::{Address as _, MockAuth, MockAuthInvoke},
    Address, Env, IntoVal,
};

fn setup() -> (Env, EunomiaPolicyClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let id = env.register(EunomiaPolicy, (admin,));
    (env.clone(), EunomiaPolicyClient::new(&env, &id))
}

#[test]
fn whitelisted_payee_is_authorized() {
    let (env, policy) = setup();
    let token = Address::generate(&env); // a confidential token would pass its own address
    let payee = Address::generate(&env);

    // Unknown payee is rejected — the default is a closed allowlist.
    assert!(!policy.is_authorized(&payee, &token));

    policy.add_payee(&payee);
    assert!(policy.is_authorized(&payee, &token));

    policy.remove_payee(&payee);
    assert!(!policy.is_authorized(&payee, &token));
}

// A stand-in ERC-8004 reputation registry: every account scores 80.
#[contract]
pub struct MockReputation;

#[contractimpl]
impl MockReputation {
    pub fn reputation_of(_env: Env, _agent: Address) -> i128 {
        80
    }
}

#[test]
fn reputation_gated_payee_is_authorized() {
    let (env, policy) = setup();
    let token = Address::generate(&env);
    let payee = Address::generate(&env); // NOT whitelisted
    let rep = env.register(MockReputation, ());

    // No reputation policy yet → a non-whitelisted payee is rejected.
    assert!(!policy.is_authorized(&payee, &token));

    // Gate at min 50; the payee scores 80 → authorized by earned trust.
    policy.set_reputation_policy(&rep, &50);
    assert!(policy.is_authorized(&payee, &token));

    // Raise the bar above the score → rejected again.
    policy.set_reputation_policy(&rep, &100);
    assert!(!policy.is_authorized(&payee, &token));

    // min_reputation = 0 disables the gate (whitelist-only) → rejected.
    policy.set_reputation_policy(&rep, &0);
    assert!(!policy.is_authorized(&payee, &token));
}

// A registry with a per-account score, so one test can hold accounts on both sides of
// the threshold.
#[contract]
pub struct ScoredReputation;

#[contractimpl]
impl ScoredReputation {
    pub fn set_score(env: Env, agent: Address, score: i128) {
        env.storage().persistent().set(&agent, &score);
    }

    pub fn reputation_of(env: Env, agent: Address) -> i128 {
        env.storage().persistent().get(&agent).unwrap_or(0)
    }
}

/// Deploy a policy WITHOUT blanket auth mocking, so each call has to be signed by the
/// account the test names.
fn setup_strict() -> (Env, Address, Address, EunomiaPolicyClient<'static>) {
    let env = Env::default();
    let admin = Address::generate(&env);
    let id = env.register(EunomiaPolicy, (admin.clone(),));
    (env.clone(), admin, id.clone(), EunomiaPolicyClient::new(&env, &id))
}

#[test]
fn add_payee_refuses_a_non_admin() {
    let (env, admin, id, policy) = setup_strict();
    let stranger = Address::generate(&env);
    let payee = Address::generate(&env);

    env.mock_auths(&[MockAuth {
        address: &stranger,
        invoke: &MockAuthInvoke {
            contract: &id,
            fn_name: "add_payee",
            args: (payee.clone(),).into_val(&env),
            sub_invokes: &[],
        },
    }]);
    assert!(policy.try_add_payee(&payee).is_err());
    assert!(!policy.is_payee(&payee));

    // The same call signed by the admin goes through.
    env.mock_auths(&[MockAuth {
        address: &admin,
        invoke: &MockAuthInvoke {
            contract: &id,
            fn_name: "add_payee",
            args: (payee.clone(),).into_val(&env),
            sub_invokes: &[],
        },
    }]);
    policy.add_payee(&payee);
    assert!(policy.is_payee(&payee));
}

#[test]
fn remove_payee_refuses_a_non_admin() {
    let (env, admin, id, policy) = setup_strict();
    let stranger = Address::generate(&env);
    let payee = Address::generate(&env);

    env.mock_auths(&[MockAuth {
        address: &admin,
        invoke: &MockAuthInvoke {
            contract: &id,
            fn_name: "add_payee",
            args: (payee.clone(),).into_val(&env),
            sub_invokes: &[],
        },
    }]);
    policy.add_payee(&payee);

    env.mock_auths(&[MockAuth {
        address: &stranger,
        invoke: &MockAuthInvoke {
            contract: &id,
            fn_name: "remove_payee",
            args: (payee.clone(),).into_val(&env),
            sub_invokes: &[],
        },
    }]);
    assert!(policy.try_remove_payee(&payee).is_err());
    assert!(policy.is_payee(&payee));
}

#[test]
fn set_reputation_policy_refuses_a_non_admin() {
    let (env, _admin, id, policy) = setup_strict();
    let stranger = Address::generate(&env);
    let token = Address::generate(&env);
    let payee = Address::generate(&env);
    let rep = env.register(MockReputation, ());

    env.mock_auths(&[MockAuth {
        address: &stranger,
        invoke: &MockAuthInvoke {
            contract: &id,
            fn_name: "set_reputation_policy",
            args: (rep.clone(), 50_i128).into_val(&env),
            sub_invokes: &[],
        },
    }]);
    assert!(policy.try_set_reputation_policy(&rep, &50).is_err());
    // The refused call must not have switched the gate on.
    assert!(!policy.is_authorized(&payee, &token));
}

#[test]
fn remove_payee_only_drops_the_named_payee() {
    let (env, policy) = setup();
    let token = Address::generate(&env);
    let kept = Address::generate(&env);
    let dropped = Address::generate(&env);
    let never_added = Address::generate(&env);

    policy.add_payee(&kept);
    policy.add_payee(&dropped);
    policy.remove_payee(&dropped);
    // Removing someone who was never listed is a no-op, not an error.
    policy.remove_payee(&never_added);

    assert!(policy.is_authorized(&kept, &token));
    assert!(!policy.is_authorized(&dropped, &token));
    assert!(!policy.is_payee(&never_added));
}

#[test]
fn score_below_the_threshold_is_rejected_and_the_threshold_itself_passes() {
    let (env, policy) = setup();
    let token = Address::generate(&env);
    let rep_id = env.register(ScoredReputation, ());
    let rep = ScoredReputationClient::new(&env, &rep_id);
    let low = Address::generate(&env);
    let at = Address::generate(&env);
    let high = Address::generate(&env);
    rep.set_score(&low, &49);
    rep.set_score(&at, &50);
    rep.set_score(&high, &51);

    policy.set_reputation_policy(&rep_id, &50);

    assert!(!policy.is_authorized(&low, &token));
    assert!(policy.is_authorized(&at, &token));
    assert!(policy.is_authorized(&high, &token));
}

#[test]
fn whitelist_overrides_a_failing_reputation_score() {
    let (env, policy) = setup();
    let token = Address::generate(&env);
    let rep_id = env.register(ScoredReputation, ());
    let payee = Address::generate(&env); // scores 0, far below the bar

    policy.set_reputation_policy(&rep_id, &50);
    assert!(!policy.is_authorized(&payee, &token));

    policy.add_payee(&payee);
    assert!(policy.is_authorized(&payee, &token));
}
