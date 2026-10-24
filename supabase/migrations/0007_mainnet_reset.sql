-- The move to mainnet. Every row so far came from the retired testnet app: activity it logged,
-- the funnel of people trying it, and what the chain indexer read off testnet. None of it
-- describes a mainnet treasury, and left in place it would be shown and counted as if it did.
--
-- Run once, after eunomia.finance stops serving the testnet app (the DNS move): until then
-- that app keeps writing testnet rows into these same tables.
--
-- Nothing is destroyed: the rows are copied into `testnet_archive` first, a schema with no
-- grants to anon or authenticated, so the API cannot reach it. `feedback` is not about a
-- network and stays.
--
-- Review L8 asked for the NOT VALID constraints of 0003 to be validated. On the live project
-- (2026-10-24) every check constraint on `activity` and `feedback` already reports
-- convalidated = true, so there is nothing left to validate here.

create schema if not exists testnet_archive;
revoke all on schema testnet_archive from anon, authenticated;

create table testnet_archive.activity as table public.activity;
create table testnet_archive.funnel_events as table public.funnel_events;
create table testnet_archive.chain_treasuries as
  select * from public.chain_treasuries where network = 'testnet';
create table testnet_archive.chain_events as
  select * from public.chain_events where network = 'testnet';
create table testnet_archive.chain_cursor as
  select * from public.chain_cursor where network = 'testnet';

delete from public.activity;
delete from public.funnel_events;
delete from public.chain_treasuries where network = 'testnet';
delete from public.chain_events where network = 'testnet';
delete from public.chain_cursor where network = 'testnet';
