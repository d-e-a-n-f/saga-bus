/**
 * Database Stores Example - Overview
 *
 * This example shows how to use different database stores with saga-bus.
 * Each store has its own demo file that you can run independently:
 *
 * - PostgreSQL: pnpm demo:postgres
 * - MySQL:      pnpm demo:mysql
 * - SQL Server: pnpm demo:sqlserver
 * - MongoDB:    pnpm demo:mongo
 * - Redis:      pnpm demo:redis
 *
 * All stores implement the same SagaStore interface, making them interchangeable.
 * Choose based on your existing infrastructure and requirements:
 *
 * | Store      | Use Case                          | Features                    |
 * |------------|-----------------------------------|-----------------------------|
 * | PostgreSQL | General production use            | ACID, JSON, mature          |
 * | MySQL      | LAMP stack, PlanetScale           | Wide compatibility          |
 * | SQL Server | Windows/.NET, Azure SQL           | Enterprise, Azure native    |
 * | MongoDB    | Document-oriented, flexible       | Schema-less, horizontal     |
 * | Redis      | High-performance, caching         | Fast, TTL support           |
 */

console.log("=".repeat(60));
console.log("  Saga-Bus Database Stores Example");
console.log("=".repeat(60));
console.log();
console.log("Available demos:");
console.log("  pnpm demo:postgres  - PostgreSQL store demo");
console.log("  pnpm demo:mysql     - MySQL store demo");
console.log("  pnpm demo:sqlserver - SQL Server store demo");
console.log("  pnpm demo:mongo     - MongoDB store demo");
console.log("  pnpm demo:redis     - Redis store demo");
console.log();
console.log("Each demo requires the corresponding database to be running.");
console.log("See the individual demo files for connection configuration.");
