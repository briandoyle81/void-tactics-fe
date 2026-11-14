# NEAR contract requests from the frontend

## Status (2026-11-14 evening)

Every request in the first version of this doc (2026-11-13) has been answered by the contracts agent's `near-frontend-handoff-2026-11-14.md` (§1–9, live since the fresh testnet deploy at 17:34 UTC), and the frontend now uses each answer:

| Request | Contract answer | Frontend |
|---|---|---|
| Minter-gated mint | `create_ships_for` (MINTER), storage attached by the minter | `/api/flow/fulfill` mints with it; card checkout stays hidden until `NEXT_PUBLIC_CARD_CHECKOUT_ENABLED=1` |
| Map terrain update | `update_full_preset_map`, `set_map_mode` | Map editor saves terrain and changes mode |
| Roguelike node update | `update_rl_node` | Node editor |
| AI config update | `update_ai_ship_config` | AI Fleet admin |
| Games for player | `get_games_for_player` | Battles (finished games on any device); the localStorage list is gone |
| All roguelike nodes | `get_rl_nodes`, `get_rl_node_count` | Admin lists, no id probing |
| Tutorial completed | `is_tutorial_completed` | `useTutorialCompleted` |
| Grant claimed | `is_rl_grant_claimed` | Reward ships and the result screen |
| Settings getters | `get_settings`, `get_lobby_config` | `useGameSettings` / `useLobbyConfig`: heal cap, repair cost, recycle reward, gated variants, max variant, max placements, verification switches, lobby fees |
| Selfie gate | `get_settings` switches + `is_eligible` | `useSelfieCheckEligibility` |
| Change counters | `get_game_version`, `get_player_nonce` | `NearSyncHost` polls them instead of whole boards and lists |
| Seed ids | `near/deployments/testnet.json` | Seed export and web2 import |
| Move log for replay | Every game-changing event carries the whole board (§7) | **Open:** needs an indexer (below) |

Also picked up from the handoff: `sync_ship_costs` (Fleet's update buttons), `construct_ships` (batch), paginated `get_preset_maps` / `get_ai_ship_configs`, `get_games` (batched Battles reads), live map edits (`game_map_edited` reaches the open game through its version), and the FastNEAR endpoint `https://test.rpc.fastnear.com`.

## Still open

1. **Replay indexer.** The contract side is done; someone has to build and host an indexer that stores `void_tactics` events per game and serves `GET /replay/<game_id>` (handoff §7 has a sketch). It's read-only, so CLAUDE.md's backend rule allows it. Until then replay covers only moves this device saw.
2. **Minter account.** The owner needs to grant MINTER (`role_bits` 4) to the server account that signs `/api/flow/fulfill`, and the checkout must exist in the NEAR Dynamic project.

## Not used yet (no need today)

`get_ship_attributes` (the app computes the same numbers locally from the live tables), `get_run_view` (the run screens already batch their reads), the move-preview views (`has_line_of_sight` etc.; the client has the same rules locally), `mt_burn`, token metadata views, and two-step ownership transfer.
