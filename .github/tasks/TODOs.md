# TODOs

This is the user-maintained task queue. Follow the workflow in `tasks/README.md`.

Default rule: implement only the first unchecked item unless the user explicitly says otherwise.

## Task List

<!-- Add one short task per line using: - [ ] short task description -->

- [x] events retrieved with an end date should retrieve event with that date and 23:59 as time. currently it is getting time as 00:00 on the end date filter.
- [x] adjust the frontend to send the end date with 23:59 as time automatically as end date is being used as a date-only filter. This should be applied on index when filtering events, and on week view when filtering events by week.
- [x] events bordering the end of the day, like day 1 at 23:00 in pt zone are being saved as the next day, like day 2 at 02:00. this is the right behaviour as the server always saves UTC. But when retrieving events from day 1, it is filtering out that kind of event that should be shown.