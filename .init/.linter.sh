#!/bin/bash
cd /tmp/kavia/workspace/code-generation/simple-todo-application-5131-5141/todo_frontend
npm run build
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
   exit 1
fi

