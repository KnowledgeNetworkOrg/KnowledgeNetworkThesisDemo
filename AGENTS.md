# Agents

For any coding agent working in this repository, whichever one it is, CLI tool or desktop
app.

- **This file holds the house rules.** They are written here and nowhere else, so read this
  file rather than relying on a summary of it.
- **`CLAUDE.md` is the project's map**: what the app is, where its knowledge lives, and which
  source to trust for what.

## Pull request review

**Status: ON.** This process stands in until the KnowledgeNetwork-Code tool is ready for
use. Only the repository owner turns it off, by changing this line.

These rules apply across the KnowledgeNetwork projects; this is this repository's copy.

1. **Every pull request is reviewed by two or more agents before it merges.** The agent that
   wrote the change is one of them, and at least one other reviews it. A reviewer may be a
   CLI coding tool or a desktop app. A separate session counts as another agent, even on the
   same model. What matters is that the reviewer did not write the change.

2. **The rounds (rule 4) stay with the author; the pull request gets one closing comment.**
   This keeps the thread short without losing what each round found. Reviewers report to the
   author, not to the pull request. A review from a desktop app reaches the author some other
   way, for example pasted in by the owner; it counts in its round like any other review, and
   the owner passes the author's answers back to it.

   When the change is ready, or the rounds stop getting closer, the author posts the closing
   comment, a plain comment in the pull request's conversation:
   - first, the state: ready, or stalled and left to the owner;
   - who reviewed, and each round's verdicts, one line per round;
   - a table of every point raised: who raised it, in which round, where in the change it was
     (file and line as they stood in that round, or the description), and how it ended: fixed
     (with the commit), not fixed (with why), or still disputed (left to the owner). If no
     point was raised, it says so;
   - each reviewer's final review, folded underneath in a click-to-open section.

   Earlier rounds' full wording is not posted; each of their points lives on as a row of the
   table. If the comment does not fit in one GitHub comment (65,536 characters), the state and
   the table come first and the folded reviews go on in further comments. If rounds start
   again after it, a new closing comment covers only the new rounds. The owner does not merge
   until the closing comment is posted.

3. **Say who you are.** Every agent posts through the same GitHub account, so GitHub's author
   field tells nobody anything. Start every review, the closing comment and each comment that
   continues it with your name in the form `<model>-<effort or variant>`, for example
   **Opus-5.5-high**. Use the model and the effort level (or, in opencode, the variant) your
   tool is actually running. If you cannot tell, write `unknown` in that place; do not guess.
   Reviews stay with the author, but carry the name, so the closing comment can say who said
   what; each one folded into it keeps its reviewer's name at the top. The
   author also puts its name at the top of the pull request description, so a reviewer can
   see it is not reviewing its own work.

4. **The author runs the review rounds, as many as it takes, until the change is ready.** It
   starts reviewer agents itself, each in a fresh session rather than a copy of its own
   conversation, answers them, and starts the next round, without stopping to ask the owner
   in between. A reviewer it cannot start, such as a desktop app, it asks the owner to bring
   in, and the change is not ready until that review is in.

   Every review ends with one verdict: **REVISE** (something must be fixed), **MINOR** (only
   optional suggestions) or **PASS** (nothing to add). The author answers every point, either
   fixed (name the commit) or not fixed (say why), and hands each new round's reviewers the
   earlier points with their answers. The reviewer checks each answer against the new code,
   not against the reply. There is no set number of rounds:

   - **Ready** means the latest verdict of every reviewer other than the author is MINOR or
     PASS, and nothing that changes what the code or text does has been edited since they
     last read it.
   - A REVISE means another round: its fixes go back to the reviewers.
   - A suggestion taken from a MINOR verdict needs no round of its own if it changes only how
     something is said, not what the code or text does. If unsure, treat it as changing what
     the code or text does.
   - If the rounds stop getting closer, stop instead of looping: post the closing comment
     (rule 2) with the disputed points, and tell the owner.

   Ready means the change can merge once its closing comment (rule 2) is posted, not that it
   is merged. The owner merges.

GitHub does not let an account approve its own pull request, and every agent is that
account, so nothing is ever posted as a GitHub review or approval. The reviews reach GitHub
only inside rule 2's closing comment and any comments that continue it, each review ending
with its verdict.
