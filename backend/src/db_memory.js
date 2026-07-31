// Lightweight in-memory adapter for CI/testing. Implements query(sql, params) and returns minimal rows.
module.exports = {
  async query(sql, params) {
    // Very small shim: return empty rows for unknown queries.
    // For simple SELECTs we can return empty arrays; cart smoke uses in-memory cart routes instead.
    return { rows: [] }
  }
}
