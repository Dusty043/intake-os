# Known Constraints

- The uploaded repository contained product/build documentation but no application code before TASK-0001.
- Live external provisioning is not safe to implement until GitHub org, repo privacy defaults, Monday board structure, and integration credentials strategy are confirmed.
- `docs/product/distribution-rules.md` is referenced by the build guide and requirements trace but was not present in the uploaded repository.
- No secrets or production configuration may be committed.
- AI may generate recommendations, but humans retain approval authority.
- The app should not become a deep bidirectional synchronization layer for every Monday/GitHub update.
- The first code slice uses no third-party runtime packages.
