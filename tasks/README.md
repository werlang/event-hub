# Task Workflow

This directory contains the workflow for turning short human-written TODO lines into tracked implementation work.

## Files

- `TODOs.md`: the user-maintained queue.
- `####-YYMMDD-task_name.md`: one self-sufficient execution file containing both plan and backlog for one task.

## Queue Rules

`TODOs.md` must stay short and simple.

- Keep a short preamble that points back to this file.
- Put each task on its own line using a checkbox: `- [ ] short human prompt`.
- Keep task text brief. The user writes the tasks manually.
- Unless the user explicitly says otherwise, the agent must pick the first unchecked task and only the first unchecked task.
- When a task is fully implemented and validated, change its checkbox to `- [x]`.
- If work is blocked or incomplete, leave the checkbox unchecked and record the blocker in the task execution file.

## Execution Flow

When the user asks the agent to implement work from `TODOs.md`, follow this sequence exactly:

1. Read `TODOs.md`.
2. Pick the first unchecked item, unless the user explicitly names another item.
3. Analyze the request, inspect the provided context, and examine the relevant code before changing files.
4. Create a task execution file inside `tasks/` before implementation starts.
5. Write the plan section in that file before coding.
6. Implement the task using the normal repository instructions, tools, and validation workflow.
7. Update the backlog section in the same file after each meaningful implementation step.
8. Validate the work.
9. Mark the TODO item as done only after the implementation and validation are complete.

## Task File Naming

Each task gets its own execution file:

```text
####-YYMMDD-task_name.md
```

Rules:

- `####`: a zero-padded incrementing number starting at `0000`.
- Increment based only on existing task execution files in `tasks/` that already follow this naming pattern.
- `YYMMDD`: the local date when the task execution file is created.
- `task_name`: a very short snake_case summary chosen by the agent.

Example:

```text
0003-260506-default_home_filters.md
```

## Self-Sufficient Plan File Contract

Create `####-YYMMDD-task_name.md` before implementation. This file must contain both the plan and the backlog history. It is the single source of truth for that task.

The file should follow the same line-oriented structure used by orchestrator plans, including metadata lines, task table lines, and worker-log lines.

Use this template:

```markdown
# Execution Plan: Short Task Title

**Request ID**: ####-YYMMDD-task_name
**Started**: YYYY-MM-DD
**Last Updated**: YYYY-MM-DD HH:MM
**Testing Requested**: true | false
**Testing Phase**: Not Requested | Pending | In Progress | Passed | Failed
**Commit Per Task Requested**: true | false
**Commit Branch**: branch-name | Not Requested

## Task Table

| ID | Task | Dependencies | Status | Last Worker | Last Updated | Notes |
|----|------|--------------|--------|-------------|--------------|-------|
| T01 | Short task summary from TODO | - | Planned | Agent | YYYY-MM-DD HH:MM | Initial extraction from TODO queue. |

## Task Details

### T01 - Short task summary from TODO
- Status: Planned | In Progress | Blocked | Complete
- Dependencies: -
- Commit: Requested | Not Requested
- Objective: Clear objective paragraph for this task.
- Done Criteria:
	- Criterion 1
	- Criterion 2
	- Criterion 3
- Notes: Optional implementation notes.

## Context

Short paragraph describing the request, nearby code surface, and the behavior to change.

## Assumptions

- Assumption or open question

## Steps

- [ ] Investigate the relevant code path
- [ ] Implement the change
- [ ] Validate the result

## Validation

- Specific test command, manual check, or build step

#### Worker Log
- YYYY-MM-DD HH:MM Agent: Created execution file and extracted first unchecked TODO.
- YYYY-MM-DD HH:MM Agent: Completed analysis and finalized implementation plan.
- YYYY-MM-DD HH:MM Agent: Implemented changes and recorded validation results.
```

## Plan and Backlog Rules

- Keep planning and backlog updates in the same task execution file.
- Keep metadata lines current (`Last Updated`, table status, detail status).
- Add a worker-log line after each meaningful step.
- Record blockers and decisions in the task details notes and worker log.
- When complete, mark status as `Complete` and include validation evidence in the worker log.

## Completion Rules

Before marking a TODO item as done:

- The requested implementation must be finished.
- Relevant validation must be completed.
- The task execution file must contain both planning and worker-log backlog updates.
- The task execution file must reflect the work that was actually done.
- The original TODO line in `TODOs.md` must be changed from `[ ]` to `[x]`.

