# Home Page

## Entry Point

Click the HiSpark Studio AI icon in the VSCode sidebar → click **Home** under Welcome.

![Home page](images/home.png)

## Layout

- **New Project** button (top left card) — opens new project creation flow
- **Import Project** button (top right card) — imports existing project
- **Project List** table — lists all existing projects with columns: Name, Path, Chip, Board, Update Time, Operation
  - Each row has **Open** and **Delete** actions
  - Search bar: "Search Project by Name"
  - Chip filter dropdown: "All Chips"
  - Pagination controls

## Interactions to Test

| Action | Expected Result |
|--------|----------------|
| Click **Open** on an existing project | Navigates to Select Model page with that project loaded |
| Click **New Project** | Opens new project creation dialog |
| Click **Import Project** | Opens import project dialog |
| Click **Delete** on a project | Removes the project from the list |
| Search by name | Filters the project list |

## Notes

- The project list may have pre-existing entries from previous test runs — tests should handle a non-empty list
- "Open" on an existing project is the primary path into the pipeline and should be the setup step for all subsequent page tests
