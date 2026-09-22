# Security Specification for Civic Complaints Backend

## 1. Data Invariants
1. Complaints must have a valid string `id` conforming to `^[a-zA-Z0-9_\-]+$`.
2. Document keys must conform strictly to the complaint schema attributes.
3. Coordinates (`latitude` and `longitude`) must be valid numbers within realistic limits (-90 to 90 for lat, -180 to 180 for lng).
4. Status must be one of the recognized lifecycle states (`Reported`, `Under Review`, `Verified`, `Assigned`, `In Progress`, `Resolved`, `Corroborated`).
5. Public reads are open so all community members, journalists, ward committees, and citizens can view transparency ledgers and live heatmaps.
6. Writes and updates require valid structural types and constraints.

## 2. The "Dirty Dozen" Payloads (Attacks Prevented)
1. Injecting 2MB payload into `title` or `description`.
2. Setting non-numeric coordinates (`latitude: "exploit"`).
3. Invalid status code outside the allowed enum.
4. Setting malicious ID path variables (`complaints/../admin`).
5. Shadow field injection (`isAdmin: true`, `backdoor: "root"`).
6. Corrupting `upvotes` with negative or fractional values or string payloads.
7. Attempting to tamper with core IDs during document update.
8. Injecting executable script into category or ward names.
9. Deleting tickets by unauthenticated or arbitrary users.
10. Overflowing ward name field with massive buffer.
11. Bypassing schema validation helper on partial document updates.
12. Attempting blanket updates without checking affected field limits.
