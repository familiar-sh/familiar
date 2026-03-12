#!/bin/bash
# When user submits a prompt, set the current Familiar task to "in-progress"
# This fires BEFORE Claude starts processing the message

if [ -n "$FAMILIAR_TASK_ID" ] && command -v familiar >/dev/null 2>&1; then
  familiar status "$FAMILIAR_TASK_ID" in-progress 2>/dev/null
  familiar update "$FAMILIAR_TASK_ID" --agent-status running 2>/dev/null
fi

exit 0
