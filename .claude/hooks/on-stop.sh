#!/bin/bash
# When Claude finishes responding, move the task to "In Review" and mark agent as done
# This lets the user review the agent's work after each turn

if [ -n "$FAMILIAR_TASK_ID" ] && command -v familiar >/dev/null 2>&1; then
  familiar status "$FAMILIAR_TASK_ID" in-review 2>/dev/null
  familiar update "$FAMILIAR_TASK_ID" --agent-status done 2>/dev/null
  familiar notify "Agent Stopped" "Task $FAMILIAR_TASK_ID — moved to In Review" 2>/dev/null
fi

exit 0
