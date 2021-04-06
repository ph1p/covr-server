FROM hayd/deno:1.8.2

EXPOSE 3000

WORKDIR /app

# Prefer not to run as root.
USER deno

# These steps will be re-run upon each file change in your working directory:
ADD . /app
# Compile the main app so that it doesn't need to be compiled each startup/entry.
RUN deno cache server.ts

# These are passed as deno arguments when run with docker:
CMD ["run", "--allow-net", "--allow-env", "server.ts"]