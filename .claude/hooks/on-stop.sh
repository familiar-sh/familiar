#!/bin/bash
# When Claude finishes responding, set the current Familiar task to "in-review"
# and send a notification

if [ -n "$FAMILIAR_TASK_ID" ] && command -v familiar >/dev/null 2>&1; then
  familiar status "$FAMILIAR_TASK_ID" in-review 2>/dev/null
  familiar update "$FAMILIAR_TASK_ID" --agent-status idle 2>/dev/null
  familiar notify "Claude Finished" "Task $FAMILIAR_TASK_ID — Claude has finished responding" --task "$FAMILIAR_TASK_ID" 2>/dev/null
fi

exit 0
