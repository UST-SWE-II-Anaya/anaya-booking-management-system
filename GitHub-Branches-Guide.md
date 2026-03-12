# Branching Workflow Guide: Anaya Booking Management System

## Phase 1: The One-Time Setup (Setting up the Sandbox)
Before anyone starts coding their features, create the `develop` branch. This acts as the shared testing ground, keeping the `main` branch clean and safe.

1. Open your terminal in the project folder.
2. Ensure you are on main and updated:
   `git checkout main`
   `git pull origin main`
3. Create and switch to the new develop branch:
   `git checkout -b develop`
4. Push the new branch to GitHub:
   `git push -u origin develop`

---

## Phase 2: The Daily Developer Workflow (The Scenario)
Here is the exact sequence of commands to follow when starting a new task. 

1. Sync with the team: Always start by making sure your local `develop` branch is up to date.
   `git checkout develop`
   `git pull origin develop`
2. Create your specific feature branch: Never code directly on `develop`. Branch off of it using a clear naming convention.
   `git checkout -b feat/your-feature-name`
3. Write code and save progress: Stage and commit changes as you complete logical chunks of work.
   `git add .`
   `git commit -m "feat: brief description of what you did"`
4. Push the feature branch to GitHub: Back up your work to the remote repository.
   `git push -u origin feat/your-feature-name`

---

## Phase 3: The Review and Merge (GitHub Pull Requests)
Once your feature is complete, it needs to be reviewed before merging into the shared `develop` branch.

1. Open a Pull Request (PR): Go to your repository on GitHub. Click the green "Compare & pull request" button for your recently pushed branch.
2. Set the target: Ensure the "base" branch is set to `develop` (NOT `main`), and the "compare" branch is your feature branch.
3. Review: Tag your partner as a Reviewer. They will check the code against the project rules and test the Vercel preview link.
4. Merge: Once approved, click the green "Merge pull request" button on GitHub.
5. Clean up: Delete the feature branch on GitHub and locally, then start the process over for your next task.