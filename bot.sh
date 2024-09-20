  while true; do
    npm run start
    if [ \$? -eq 0 ]; then
      echo 'Script executed successfully.'
      break
    else
      echo 'Script failed. Restarting...'
      sleep 1  # Optional: Wait before retrying
    fi
  done;