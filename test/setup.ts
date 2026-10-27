// Pin the timezone so assertions on locale-formatted times are reproducible.
// TodoList renders `toLocaleTimeString`, which otherwise depends on the host
// machine and makes the same test pass locally and fail elsewhere.
process.env.TZ = 'UTC'
