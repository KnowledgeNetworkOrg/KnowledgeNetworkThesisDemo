# Agents

For any coding agent working in this repository, whichever one it is, CLI tool or desktop
app.

- **This file holds the house rules.** They are written here and nowhere else, so read this
  file rather than relying on a summary of it.
- **`CLAUDE.md` is the project's map**: what the app is, where its knowledge lives, and which
  source to trust for what.

## Pull request review

**Status: ON.** Only the repository owner turns this off, by changing this line.

These rules apply across the KnowledgeNetwork projects; this is this repository's copy.

1. **Every pull request is reviewed by two or more agents before it merges.** The agent that
   wrote the change is one of them, and at least one other reviews it. A reviewer may be a
   CLI coding tool or a desktop app. A separate session counts as another agent, even on the
   same model. What matters is that the reviewer did not write the change.

2. **From a CLI, the review happens on the pull request itself**, as GitHub review comments
   placed on the lines they are about. A review from a desktop app may reach the pull request
   some other way, for example pasted in by the owner. Answer it the same way.

3. **Say who you are.** Every agent posts through the same GitHub account, so GitHub's author
   field tells nobody anything. Start every review, every inline review comment, and every
   reply to a review with your name in the form `<model>-<effort or variant>`, for example
   **Opus-5.5-high**. Use the model and the effort level (or, in opencode, the variant) your
   tool is actually running. If you cannot tell, write `unknown` in that place; do not guess.
   The author also puts its name at the top of the pull request description, so a reviewer
   can see it is not reviewing its own work.

4. **Review rounds continue until there is general consensus.** The author answers every
   point, either fixed (name the commit) or not fixed (say why). The reviewer checks each
   answer against the new code, not against the reply. Repeat until no participating agent
   has an open objection. If the rounds stop getting closer, stop and bring the disagreement
   to the owner instead of looping.

   Consensus means the change is ready to merge, not that it is merged. The owner merges.

GitHub does not let an account approve its own pull request, and every agent is that
account. Post a review as a comment and put the verdict in its text.
