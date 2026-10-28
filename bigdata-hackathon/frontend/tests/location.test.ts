import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateDistanceKm,
  districtsForProvince,
  formatOpportunityLocation,
  locationMatchesFilters,
} from "../src/location";

test("district options preserve the supplied province relationships", () => {
  const allDistricts = districtsForProvince();
  assert.equal(allDistricts.length, 30);
  assert.equal(new Set(allDistricts).size, 30);
  assert.deepEqual(districtsForProvince("Eastern Province"), [
    "Bugesera", "Gatsibo", "Kayonza", "Kirehe", "Ngoma", "Nyagatare", "Rwamagana",
  ]);
  assert.ok(districtsForProvince().includes("Huye"));
  assert.ok(!districtsForProvince("Eastern Province").includes("Huye"));
});

test("province and district filters must both match the opportunity location", () => {
  const location = { province: "Eastern Province", district: "Kirehe" };
  assert.equal(locationMatchesFilters(location, "Eastern Province", "Kirehe"), true);
  assert.equal(locationMatchesFilters(location, "Southern Province", "Kirehe"), false);
  assert.equal(locationMatchesFilters(location, "", "Kirehe"), true);
});

test("distance calculation returns straight-line kilometres for valid coordinates", () => {
  const distance = calculateDistanceKm(
    { latitude: 0, longitude: 0 },
    { latitude: 1, longitude: 0 },
  );
  assert.ok(distance !== null);
  assert.ok(Math.abs(distance - 111.195) < 0.01);
  assert.equal(calculateDistanceKm(
    { latitude: 0, longitude: 0 },
    { latitude: 91, longitude: 0 },
  ), null);
});

test("location labels show available fields without fabricating a missing place", () => {
  assert.equal(formatOpportunityLocation({ province: "Eastern Province", district: "Kirehe" }), "Eastern Province · Kirehe District");
  assert.equal(formatOpportunityLocation({ province: "City of Kigali" }), "City of Kigali");
  assert.equal(formatOpportunityLocation({ displayLocation: "Nationwide, Rwanda" }), "Nationwide, Rwanda");
  assert.equal(formatOpportunityLocation(undefined), "Location not specified");
});
