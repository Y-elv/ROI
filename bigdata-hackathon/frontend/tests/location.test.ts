import assert from "node:assert/strict";
import test from "node:test";
import {
  distanceToOpportunity,
  districtsForProvince,
  formatOpportunityLocation,
  haversineDistanceKm,
  isValidCoordinates,
  locationMatchesFilters,
  sortByDistance,
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

test("coordinate validation and Haversine distance use valid geographic ranges", () => {
  assert.equal(isValidCoordinates({ latitude: -90, longitude: 180 }), true);
  assert.equal(isValidCoordinates({ latitude: 91, longitude: 0 }), false);
  assert.equal(isValidCoordinates({ latitude: 0, longitude: Number.NaN }), false);
  const oneDegreeAtEquator = haversineDistanceKm(
    { latitude: 0, longitude: 0 },
    { latitude: 1, longitude: 0 },
  );
  assert.ok(oneDegreeAtEquator !== null);
  assert.ok(Math.abs(oneDegreeAtEquator - 111.195) < 0.01);
  assert.equal(haversineDistanceKm(
    { latitude: 0, longitude: 0 },
    { latitude: 95, longitude: 0 },
  ), null);
});

test("district reference coordinates are marked approximate and invalid locations have no distance", () => {
  const referenceLocation = {
    latitude: -2.2694,
    longitude: 30.6517,
    coordinateType: "district_reference" as const,
  };
  assert.deepEqual(
    distanceToOpportunity(referenceLocation, { latitude: -2.2694, longitude: 30.6517 }),
    { kilometers: 0, precision: "district_reference" },
  );
  assert.deepEqual(
    distanceToOpportunity({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 0 }),
    { kilometers: 0, precision: "unspecified" },
  );
  assert.equal(distanceToOpportunity({ latitude: 120, longitude: 0 }, { latitude: 0, longitude: 0 }), null);
  assert.equal(distanceToOpportunity(undefined, { latitude: 0, longitude: 0 }), null);
});

test("nearest sorting keeps invalid or missing coordinates after calculable distances", () => {
  const entries = [
    { id: "missing", location: undefined },
    { id: "farther", location: { latitude: 0, longitude: 1 } },
    { id: "invalid", location: { latitude: 120, longitude: 0 } },
    { id: "nearer", location: { latitude: 0, longitude: 0.5 } },
  ];
  assert.deepEqual(
    sortByDistance(entries, (entry) => entry.location, { latitude: 0, longitude: 0 }),
    [entries[3], entries[1], entries[0], entries[2]],
  );
});

test("location labels show available fields without fabricating a missing place", () => {
  assert.equal(formatOpportunityLocation({ province: "Eastern Province", district: "Kirehe" }), "Eastern Province · Kirehe District");
  assert.equal(formatOpportunityLocation({ province: "City of Kigali" }), "City of Kigali");
  assert.equal(formatOpportunityLocation({ displayLocation: "Nationwide, Rwanda" }), "Nationwide, Rwanda");
  assert.equal(formatOpportunityLocation(undefined), "Location not specified");
});
