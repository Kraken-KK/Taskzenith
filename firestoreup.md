
# TaskZenith: Firestore Data Robustness & Collaboration Plan

This document outlines a plan to enhance the robustness of data persistence in Firestore and to lay the groundwork for more advanced collaborative features within TaskZenith. The goal is to ensure data integrity, improve user experience for individual data management, and correctly structure data for future sharing capabilities.

## Section 1: User-Specific Data Persistence (Boards & Board Groups)

This section focuses on ensuring that data directly managed by individual users (their personal boards and board groups) is saved and loaded reliably.

**Problem Statement:**
Currently, there might be inconsistencies in how user-specific data like boards and board groups are saved to and loaded from Firestore (for logged-in users) or `localStorage` (for guest users). This can lead to data loss, missing properties, or incorrect associations.

**Solutions & Enhancements (primarily in `TaskContext.tsx`):**

1.  **Robust Data Loading (`loadData` function):**
    *   **Firestore (Logged-in Users):**
        *   When fetching data from the `users/{userId}` document, rigorously check for the existence and correct type of `boards`, `activeBoardId`, and `boardGroups` fields.
        *   **Sanitization on Load:** For each `Board` loaded:
            *   Ensure `id`, `name`, and `createdAt` have valid values (generate defaults if missing, especially for older data).
            *   Ensure `columns` is an array. Each `Column` within it must have an `id`, `title`, and `tasks` (which should also be an array). Default WIP limits (e.g., 0) if undefined.
            *   For each `Task` within a column: Ensure `id`, `content`, `priority`, and `createdAt` are present. `status` should be correctly set to its parent column's ID.
            *   Initialize optional/newer fields to their defaults if missing:
                *   `Board.theme: {}`
                *   `Board.groupId: null`
                *   `Board.organizationId: null`
                *   `Board.teamId: null`
                *   `Board.isPublic: false`
                *   `Task.description: undefined`
                *   `Task.deadline: undefined`
                *   `Task.dependencies: []`
                *   `Task.checklist: []` (each item with `id`, `text`, `completed`)
                *   `Task.tags: []`
                *   `Task.assignedTo: []`
            *   Use `assignTaskStatusToColumns` (or a similar utility) consistently to ensure tasks have their `status` correctly reflecting their parent column ID, which is crucial for drag-and-drop and data integrity.
        *   **Board Groups:** For each `BoardGroup` loaded:
            *   Ensure `id`, `name`, `boardIds` (as an array), and `createdAt` are present and correctly typed.
        *   **Active Board ID:**
            *   Validate that the loaded `activeBoardId` corresponds to an existing board.
            *   If not, or if `activeBoardId` is missing, set it to the ID of the first board in the `boards` array.
            *   If no boards exist, set `activeBoardId` to `null`.
            *   If a default `activeBoardId` was set because the loaded one was invalid/missing, this change should be persisted back to Firestore.
    *   **localStorage (Guest Users):**
        *   Apply the same sanitization and default-setting logic when parsing data from `localStorage` to ensure consistency with the Firestore data structure.
        *   If `localStorage` data is missing or corrupt, initialize with a fresh default board (e.g., `initialDefaultBoardForGuest`).

2.  **Robust Data Saving (`saveData` function):**
    *   **Firestore (Logged-in Users):**
        *   Before calling `updateDoc` on `users/{userId}`:
            *   Perform a final sanitization pass on the `boards` and `boardGroups` arrays being saved. This ensures all objects have required IDs and default values for optional fields (as detailed in the "Sanitization on Load" section). This is especially important for newly created items that might not have gone through a full load-sanitize cycle.
            *   Ensure `activeBoardId` is correctly part of the data payload.
    *   **localStorage (Guest Users):**
        *   Ensure the data stringified to `localStorage` is also sanitized to maintain structural consistency.

3.  **Consistent ID Generation:**
    *   Use the `generateId` utility for *all* new entities created within `TaskContext` (boards, columns, tasks, board groups, checklist items) to prevent missing IDs or potential collisions.

4.  **Error Handling:**
    *   Wrap Firestore read/write operations in `try...catch` blocks.
    *   Use `toast` notifications to inform the user of critical load/save failures.
    *   Log detailed errors to the console for debugging.

## Section 2: Collaboration - Organization-Scoped Boards

This section addresses making boards visible and manageable within an organizational context.

**Problem Statement:**
Boards are currently stored within individual user documents (`users/{userId}/boards`). This makes them private by default. Setting an `organizationId` on such a board marks its association but doesn't automatically make it accessible to other organization members.

**Phase 1: Data Association and UI Indication (Current Scope)**

*   **Objective:** Correctly associate boards with organizations/teams at the data level, and reflect this in the UI, without changing the core storage model yet.
*   **Changes in `TaskContext.tsx` (`addBoard` function):**
    *   When a new board is created:
        *   If the `currentUser` (from `AuthContext`) has a `defaultOrganizationId` set, automatically populate the new `Board` object's `organizationId` field with this value.
        *   (Future) Similarly, if a default team is relevant, populate `teamId`.
*   **Changes in UI (`app/page.tsx`):**
    *   In the sidebar where boards are listed, visually differentiate boards that have an `organizationId` and/or `teamId` (e.g., by showing a "Building" icon for org boards, "Users" icon for team boards). This provides clarity to the user about the board's intended scope.
*   **Limitations:** This phase **does not** make these boards automatically visible or editable by other members of the organization/team. It only prepares the data for such features.

**Phase 2: True Shared Boards (Future Architectural Change - Out of Immediate Scope)**

*   **Objective:** Allow multiple users within an organization/team to view and collaborate on the same set of boards.
*   **Core Idea:** Move boards intended for collaboration out of individual user documents and into a shared Firestore structure.
*   **Potential Structures:**
    1.  **Top-Level `boards` Collection:**
        *   Each document in `/boards/{boardId}` would contain the board data.
        *   Each board document would have `organizationId` and optionally `teamId` fields.
        *   Firestore security rules would control read/write access based on user's membership in the `organizationId`/`teamId`.
    2.  **Nested `boards` Subcollection:**
        *   Store boards under their respective organizations: `/organizations/{orgId}/boards/{boardId}`.
        *   Firestore rules would be based on the path and user's membership in the parent organization.
*   **Impact of Architectural Change:**
    *   **`TaskContext.tsx`:**
        *   `loadData`: Would need to query the shared `boards` collection based on the user's current organization/team memberships, in addition to their personal boards from `users/{userId}/boards`.
        *   `saveData`: Operations on shared boards would write to the shared collection, not the user's document.
    *   **`AuthContext.tsx`:** May need to provide more granular information about the user's team memberships and roles within organizations/teams for permission checking.
    *   **UI:** Significant UI changes to distinguish between personal boards and shared/organizational boards.
    *   **Firestore Security Rules:** This is the most critical part. Rules must be meticulously crafted:
        *   Who can create org/team boards?
        *   Who can view boards of an org/team they are a member of?
        *   Who can edit tasks/columns on these shared boards? (Consider roles: owner, admin, member, viewer).
    *   **Migration:** A strategy would be needed if existing user-associated boards need to be "moved" or "promoted" to an organization.

## Section 3: Collaboration - Team Visibility & Management

This section focuses on ensuring teams are correctly set up and their memberships are accurately reflected.

**Problem Statement:**
Newly created teams or changes in team membership might not be immediately or correctly visible to all relevant users.

**Solutions & Enhancements (primarily in `AuthContext.tsx`):**

1.  **Team Creation (`createTeam` function):**
    *   **Atomic Updates:** Use Firestore `writeBatch` for all related document updates to ensure atomicity.
    *   **`teams` Collection:**
        *   When a new team document is created in `/teams/{newTeamId}`:
            *   The `memberIds` array **must** include the `currentUser.id` (creator).
            *   The `adminIds` array **must** include the `currentUser.id`.
            *   `organizationId` must be correctly set.
    *   **`organizations` Collection:**
        *   The `organizations/{orgId}` document's `teamIds` array must be updated with `arrayUnion(newTeamId)`.
    *   **`users` Collection (Creator):**
        *   The `users/{currentUser.id}` document's `teamMemberships` array must be updated with `arrayUnion(newTeamId)`.
    *   **Local State Update:** After successful Firestore operations, update the `currentUser` state in `AuthContext` to reflect the new team membership (`teamMemberships` array).

2.  **Joining a Team (`joinTeam` function - and `joinOrganizationByInviteCode` implications):**
    *   **Atomic Updates:** Use `writeBatch`.
    *   **`teams` Collection:**
        *   Update `teams/{teamId}` document by adding `currentUser.id` to its `memberIds` array using `arrayUnion`.
    *   **`users` Collection (Joining User):**
        *   Update `users/{currentUser.id}` document by adding `teamId` to its `teamMemberships` array using `arrayUnion`.
    *   **Local State Update:** Update `currentUser.teamMemberships` in `AuthContext`.
    *   **`joinOrganizationByInviteCode`:** When a user joins an organization, they are not automatically added to any teams. The UI flow after joining an org should allow them to see and request to join (or be added to) teams within that org.

3.  **Fetching Teams (`getUserTeams(organizationId?: string)` function):**
    *   **Query Logic:**
        *   If `organizationId` is provided: `query(collection(db, "teams"), where("organizationId", "==", organizationId), where("memberIds", "array-contains", currentUser.id))` is correct. This fetches teams for the specified organization that the current user is a member of.
        *   If `organizationId` is *not* provided (to fetch all teams a user is in across all their orgs): `query(collection(db, "teams"), where("memberIds", "array-contains", currentUser.id))`.
    *   **Data Mapping:** Ensure the `Team` objects returned from this function correctly map Firestore data, including converting timestamps.
    *   **Real-time Updates (Optional but Recommended):** Consider changing `getUserTeams` (and `getUserOrganizations`) to use `onSnapshot` if real-time updates to team/org lists are desired in the UI without manual refresh. This would involve returning an unsubscribe function.

4.  **Leaving a Team / Being Removed (Future Consideration):**
    *   Requires updating `memberIds` in the team document and `teamMemberships` in the user document.
    *   Admins might also need to be managed.

## Section 4: Firestore Security Rules

This is paramount for any collaborative application. As features evolve, security rules must be updated in lockstep.

*   **User-Specific Data (`users/{userId}` and subcollections like `aiChatSessions`):**
    *   `allow read, write: if request.auth.uid == userId;`
    *   This ensures users can only access their own profile, settings, personal boards (if still stored here), and AI chat history.

*   **Organizations (`organizations/{orgId}`):**
    *   `allow read: if request.auth.uid in resource.data.memberIds;`
    *   `allow create: if request.auth.uid != null && request.resource.data.ownerId == request.auth.uid && request.resource.data.memberIds[0] == request.auth.uid;` (Ensures creator is owner and first member).
    *   `allow update (e.g., name, description): if request.auth.uid == resource.data.ownerId;`
    *   `allow update (memberIds - for joining via invite): if request.auth.uid != null && get(/databases/$(database)/documents/organizations/$(orgId)).data.inviteCode == request.resource.data.inviteCodeUsed;` (This is complex and needs careful implementation for invite code logic). A Cloud Function might be safer for invite code redemption.
    *   `allow update (teamIds): if request.auth.uid == resource.data.ownerId;` (or by an admin role if implemented).

*   **Teams (`teams/{teamId}`):**
    *   `function isOrgMember(orgId) { return get(/databases/$(database)/documents/organizations/$(orgId)).data.memberIds.hasAny([request.auth.uid]); }`
    *   `allow read: if request.auth.uid in resource.data.memberIds && isOrgMember(resource.data.organizationId);`
    *   `allow create: if request.auth.uid != null && isOrgMember(request.resource.data.organizationId) && request.resource.data.adminIds[0] == request.auth.uid && request.resource.data.memberIds[0] == request.auth.uid;`
    *   `allow update (e.g., name, description, memberIds by admin): if request.auth.uid in resource.data.adminIds && isOrgMember(resource.data.organizationId);`

*   **Shared Boards (Future - `/boards/{boardId}` or `/organizations/{orgId}/boards/{boardId}`):**
    *   Rules would depend on the chosen structure.
    *   Generally: `allow read: if isOrgMember(resource.data.organizationId) && (resource.data.teamId == null || request.auth.uid in get(/databases/$(database)/documents/teams/$(resource.data.teamId)).data.memberIds);`
    *   Write permissions would be more granular (e.g., only team members can edit tasks on a team board).

**Note on Security Rules:** These are illustrative. Actual implementation requires careful testing. Using `get()` calls in rules can impact performance and cost if not used judiciously.

## Conclusion

Implementing these changes will require careful updates to `TaskContext.tsx`, `AuthContext.tsx`, and eventually Firestore security rules. The phased approach, starting with data integrity for individual users and then gradually building out the data structures and logic for collaboration, is recommended. The long-term vision for shared boards represents a significant architectural shift that should be planned carefully.
