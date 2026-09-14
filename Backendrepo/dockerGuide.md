



**Services Not Ready, when tried to run seed**

What went wrong and how to debug it
Bug 1: Broken health URL in seed.js
The original waitForServices had this URL construction:


`${GATEWAY}/auth/health`.replace("/api/auth", "").replace("/api", "").replace("//", "/")
With GATEWAY = "http://api-gateway:3000/api", the chain went:

Start: "http://api-gateway:3000/api/auth/health"
.replace("/api/auth", "") → "http://api-gateway:3000/health"
.replace("/api", "") → no change (already gone)
.replace("//", "/") → "http:/api-gateway:3000/health" — corrupted the http:// protocol
The || fallback never triggered because a non-empty string is truthy, even if it's a broken URL. Every axios request failed with a network error, so the seed always hit the catch block and printed "Services not ready yet" 30 times, then exited.

How to spot this next time:


docker-compose run --rm seed
# Look for the log: "Waiting for services to be ready (polling <URL>)..."
# If the URL looks wrong, that's your problem
Bug 2: No Docker healthchecks on services
The original docker-compose.yml only had a healthcheck on MongoDB. The api-gateway used a simple depends_on list (no condition: service_healthy), so Docker started it as soon as the service containers launched — not when the Express servers inside were actually listening. Same for the seed container.

How to check service health yourself:


# See container health status
docker-compose ps

# Hit the gateway health endpoint directly
curl http://localhost:3000/health

# Check individual service health
curl http://localhost:3001/health   # auth
curl http://localhost:3002/health   # patient
curl http://localhost:3003/health   # appointment
curl http://localhost:3004/health   # prescription
curl http://localhost:3005/health   # notification
If docker-compose ps shows healthy for all services but the seed still fails, the issue is inside the seed script (like Bug 1). If services show starting or unhealthy, the services themselves aren't ready yet.

Bug 3: Stale Docker image
After fixing the code, you ran docker-compose run --rm seed — but Docker used the cached old image with the broken code. docker-compose run does not rebuild automatically.

The fix / command to remember:


# Always rebuild after code changes
docker-compose run --rm --build seed

# Or rebuild explicitly first
docker-compose build seed
docker-compose run --rm seed
How to check if your image is stale:


# See when the image was last built
docker images | grep seed
Quick reference for future issues
Symptom	Command to debug
Services not starting	docker-compose ps (check STATUS column)
Seed can't reach gateway	docker-compose run --rm seed and read the polling URL in the first log line
Code changes not taking effect	docker-compose build <service> then re-run
Want to start completely fresh	docker-compose down -v && docker-compose up --build
Check gateway sees all services	curl http://localhost:3000/health — look for "status": "healthy" vs "degraded"
