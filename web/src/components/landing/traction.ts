/** Numbers read off the chain, not claims — the single place to update them until the
 *  counter is wired to a live query.
 *
 *  Source of truth: the treasury registry plus the activity table. Keep these conservative;
 *  the page's whole argument is that its evidence is checkable.
 *
 *  null until mainnet has numbers of its own: the counts the page used to show (20 blocked,
 *  13 treasuries, 76 actions) were the retired testnet's, and a mainnet site quoting them
 *  would be quoting evidence nobody can check on the network it runs on. */
export const TRACTION: { blocked: number; treasuries: number; actions: number } | null = null;
