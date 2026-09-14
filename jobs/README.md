# jobs/ — scheduled job runs

Definitions live in `../jobs.json` (the source of truth, re-read on every
`ticks()`). This directory holds the execution records:

```
runs/<job_id>/<run_id>.md    one file per execution (run_id = scheduled slot,
                             e.g. 20260706T2300). Created with status: running,
                             updated on completion with status, output, notes.
```

The run files ARE the scheduler state: a file existing means its slot ran —
delete one to make the scheduler re-run that slot. Runtime data, gitignored.

Policies (ADR-0004): jobs run at their cron slots; missed slots (host asleep)
fire only the most recent one unless the job sets `"catch_up": true`; a failed
run claims its slot (no automatic retry until the next slot).
