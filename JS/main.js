// Module Imports

import { validate } from "./validator.js";
import { haversine } from "./distanceCalc.js";

// Variable Declarations

const savedCash = localStorage.getItem("cash");
let cash = savedCash === null ? 100000000 : Number(savedCash);

const savedReputation = localStorage.getItem("reputation");
let reputation = savedReputation === null ? 50 : Number(savedReputation);

if (!Number.isFinite(reputation)) {
    reputation = 50;
}

reputation = Math.max(0, Math.min(100, reputation));
localStorage.setItem("reputation", reputation);

if (!Number.isFinite(cash)) {
    cash = 100000000;
}

let aircraft = [];
let airport = [];

function loadStoredArray(key) {
    try {
        const storedValue = localStorage.getItem(key);
        const parsedValue = storedValue ? JSON.parse(storedValue) : [];

        return Array.isArray(parsedValue) ? parsedValue : [];
    } catch {
        return [];
    }
}

function getAirlinePrefix() {
    const airlineName = (localStorage.getItem("airlineName") || "FlyThem™ Airlines")
        .toLowerCase()
        .replace(/[^a-z\s]/g, "")
        .trim();

    const knownPrefixes = [
        ["sri lankan", "UL"],
        ["emirates", "EK"],
        ["qantas", "QF"],
        ["british airways", "BA"],
        ["qatar airways", "QR"],
        ["singapore airlines", "SQ"],
        ["etihad", "EY"],
        ["air india", "AI"],
        ["turkish airlines", "TK"],
        ["lufthansa", "LH"],
        ["american airlines", "AA"],
        ["delta", "DL"],
        ["united", "UA"]
    ];

    const knownPrefix = knownPrefixes.find(function ([name]) {
        return airlineName.includes(name);
    });

    if (knownPrefix) {
        return knownPrefix[1];
    }

    const words = airlineName
        .split(/\s+/)
        .filter(word => !["air", "airline", "airlines", "airways"].includes(word));

    if (words.length >= 2) {
        return `${words[0][0]}${words[1][0]}`.toUpperCase();
    }

    return (words[0] || "FT").slice(0, 2).toUpperCase().padEnd(2, "X");
}

function createAircraftRegistration(existingRegistrations = new Set(
    fleet.map(plane => plane.registration).filter(Boolean)
)) {
    const prefix = getAirlinePrefix();

    let number = 1;
    let registration = `${prefix}-${String(number).padStart(3, "0")}`;

    while (existingRegistrations.has(registration)) {
        number += 1;
        registration = `${prefix}-${String(number).padStart(3, "0")}`;
    }

    return registration;
}

let fleet = loadStoredArray("fleet");
let flightsList = loadStoredArray("flightsList");

const existingRegistrations = new Set(
    fleet.map(plane => plane.registration).filter(Boolean)
);

fleet = fleet.map(function (plane) {
    if (plane.registration) {
        return plane;
    }

    const registeredPlane = {
        ...plane,
        registration: createAircraftRegistration(existingRegistrations)
    };

    existingRegistrations.add(registeredPlane.registration);

    return registeredPlane;
});

localStorage.setItem("fleet", JSON.stringify(fleet));

const setupForm = document.querySelector(".setup-form");

const airlineNameDisplay = document.querySelector(".airline-name-display");
const airlineHubDisplay = document.querySelector(".airline-hub-display");
const cashDisplay = document.querySelector(".cash-display");
const reputationDisplay = document.querySelector(".reputation-display");

const aircraftCatalogContainer = document.querySelector(".aircraft-catalog");

const hubAirportSelect = document.querySelector(".hub-airport");

const createNewAirline = document.querySelector(".new-airline");
const loadAirline = document.querySelector(".load-airline");
const resetAirline = document.querySelector(".reset-airline");

const currentFleetDisplayer = document.querySelector(".currentFleetDisplayer");
const currentFleet = document.querySelector(".currentFleet");
const routesList = document.querySelector(".routes-list");
const flightPlanForm = document.querySelector(".flightPlanForm");

const timeDisplay = document.querySelector(".time-display");
const pauseGameButton = document.querySelector(".pause-game");
const advanceDayButton = document.querySelector(".advance-day");
const advanceDayCooldownDisplay = document.querySelector(".advance-day-cooldown");

// Home Code

if (airlineNameDisplay) {
    const airlineName = localStorage.getItem("airlineName");

    airlineNameDisplay.textContent = airlineName;
}

if (cashDisplay) {
    cashDisplay.textContent = `$${cash.toLocaleString()}`;
}

if (reputationDisplay) {
    reputationDisplay.textContent = `${reputation}/100`;
}

// Event Listeners

if (createNewAirline) {
    createNewAirline.addEventListener("click", function () {
        localStorage.removeItem("cash");
        localStorage.removeItem("airlineName");
        localStorage.removeItem("hubAirport");
        localStorage.removeItem("fleet");
        localStorage.removeItem("flightsList");
        localStorage.removeItem("gameDate");
        localStorage.removeItem("gamePaused");
        localStorage.removeItem("lastTimeUpdate");
        localStorage.removeItem("advanceDayCooldown");
        localStorage.removeItem("reputation");

        window.location.href = "./setup.html";
    });
}

if (loadAirline) {
    loadAirline.addEventListener("click", function () {
        if (!localStorage.getItem("airlineName")) {
            localStorage.setItem("airlineName", "FlyThem™ Airlines");
        }

        if (!localStorage.getItem("hubAirport")) {
            localStorage.setItem("hubAirport", "DXB-OMDB");
        }

        window.location.href = "./home.html";
    });
}

if (resetAirline) {
    resetAirline.addEventListener("click", function () {
        localStorage.removeItem("cash");
        localStorage.removeItem("airlineName");
        localStorage.removeItem("hubAirport");
        localStorage.removeItem("fleet");
        localStorage.removeItem("flightsList");
        localStorage.removeItem("gameDate");
        localStorage.removeItem("gamePaused");
        localStorage.removeItem("lastTimeUpdate");
        localStorage.removeItem("advanceDayCooldown");
        localStorage.removeItem("reputation");

        window.location.href = "./index.html";
    });
}

if (currentFleetDisplayer && currentFleet) {
    currentFleetDisplayer.addEventListener("click", function () {
        currentFleet.classList.toggle("open");

        if (currentFleet.classList.contains("open")) {
            currentFleetDisplayer.textContent = "Hide Fleet ▲";
        } else {
            currentFleetDisplayer.textContent = "Click to see Fleet ▼";
        }
    });
}

if (reputation <= 10) {
    customPopup(
        "Warning: Low Reputation",
        "Your airline has failed to maintain a good enough reputation. Your airline is now bankrupt. Please reset your airline to continue playing."
    );
}
// Setup Code

if (setupForm) {
    setupForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const airlineName = document.querySelector(".airline-name").value;
        const hubAirport = document.querySelector(".hub-airport").value;

        if (airport.length === 0) {
            await loadAirports();
        }

        const selectedAirport = findAirport(hubAirport);

        if (!selectedAirport) {
            console.error("Selected airport could not be found.");

            return;
        }

        localStorage.setItem("airlineName", airlineName);
        localStorage.setItem("hubAirport", hubAirport);

        window.location.href = "./home.html";
    });
}

// Classes

class flights {
    constructor(aircraft, start, destination, aircraftRegistration) {
        this.aircraft = aircraft;
        this.aircraftRegistration = aircraftRegistration;
        this.start = start;
        this.destination = destination;
    }
}

// Async Functions

async function loadAircraft() {
    const aircraftResponse = await fetch("./JSON/aircraft.json");

    const schemaResponse = await fetch(
        "./JSON/Schemas/aircraft.schema.json"
    );

    const aircraftData = await aircraftResponse.json();
    const aircraftSchema = await schemaResponse.json();

    const result = validate(
        aircraftData,
        aircraftSchema
    );

    if (!result.valid) {
        console.error("Aircraft data is invalid:");

        for (const error of result.errors) {
            console.error(error);
        }

        return;
    }

    aircraft = aircraftData.aircraft;

    createAircraftShop();
}

async function loadAirports() {
    const airportResponse = await fetch("./JSON/airports.json");

    const schemaResponseAir = await fetch(
        "./JSON/Schemas/airport.schema.json"
    );

    const airportData = await airportResponse.json();
    const airportSchema = await schemaResponseAir.json();

    const result = validate(
        airportData,
        airportSchema
    );

    if (!result.valid) {
        console.error("Airport data is invalid:");

        for (const error of result.errors) {
            console.error(error);
        }

        return;
    }

    airport = airportData.airports;

    createAirportOptions();

    updateHubAirportDisplay();
}

// Functions

function createAircraftShop() {
    if (!aircraftCatalogContainer) {
        return;
    }

    aircraftCatalogContainer.innerHTML = "";

    for (const plane of aircraft) {
        const aircraftElement = document.createElement("div");
        aircraftElement.classList.add("aircraft-item");

        aircraftElement.innerHTML = `
        <div class="aircraft-header">
            <h4 class="aircraft-name">${plane.variant}</h4>
            <h5 class="aircraft-type">Type: ${plane.aisle}</h5>
        </div>
        <p class="aircraft-manufacturer">Manufacturer: ${plane.manufacturer}</p>
        <p class="aircraft-capacity">Capacity: ${plane.seating}</p>
        <p class="aircraft-range">Range: ${plane.range_km.toLocaleString()} km</p>
        <p class="aircraft-cost">Cost: $${(plane.price * 1_000_000).toLocaleString()}</p>
        <button class="aircraft-buy-button">
            Buy Aircraft
        </button>
        `;

        const aircraftBuy = aircraftElement.querySelector(".aircraft-buy-button");

        aircraftBuy.addEventListener("click", function () {
            const aircraftCost = plane.price * 1_000_000;

            if (aircraftCost > cash) {
                customPopup(
                    "Insufficient Funds",
                    "You do not have enough cash to purchase this aircraft."
                );
            } else {
                cash -= aircraftCost;
                const registeredAircraft = {
                    ...plane,
                    registration: createAircraftRegistration()
                };
                fleet.push(registeredAircraft);

                localStorage.setItem("cash", cash);
                localStorage.setItem("fleet", JSON.stringify(fleet));

                if (cashDisplay) {
                    cashDisplay.textContent = `$${cash.toLocaleString()}`;
                }

                createFleetDisplay();

                customPopup(
                    "Aircraft Purchased",
                    `You have successfully purchased the ${plane.variant} (${registeredAircraft.registration}).`
                );
            }
        });

        aircraftCatalogContainer.appendChild(aircraftElement);
    }
}

function createAirportOptions() {
    if (!hubAirportSelect) {
        return;
    }

    hubAirportSelect.innerHTML = "";

    for (const airportData of airport) {
        const option = document.createElement("option");

        option.value = `${airportData.iata}-${airportData.icao}`;

        option.textContent =
            `${airportData.iata} - ${airportData.icao} / ${airportData.name}`;

        hubAirportSelect.appendChild(option);
    }

    const savedHubAirport = localStorage.getItem("hubAirport");

    if (savedHubAirport) {
        hubAirportSelect.value = savedHubAirport;
    }
}

function findAirport(airportCode) {
    return airport.find(function (airportData) {
        return `${airportData.iata}-${airportData.icao}` === airportCode;
    });
}

function updateHubAirportDisplay() {
    if (!airlineHubDisplay) {
        return;
    }

    const hubAirport = localStorage.getItem("hubAirport");

    if (!hubAirport) {
        airlineHubDisplay.textContent = "";

        return;
    }

    const selectedAirport = findAirport(hubAirport);

    if (!selectedAirport) {
        airlineHubDisplay.textContent = hubAirport;

        return;
    }

    airlineHubDisplay.textContent =
        `${selectedAirport.iata} - ${selectedAirport.icao} / ${selectedAirport.name}`;
}

function customPopup(title, message) {
    const popup = document.createElement("div");
    popup.classList.add("custom-popup");

    popup.innerHTML = `
        <h3 class="popup-title">${title}</h3>
        <p class="popup-message">${message}</p>
        <button class="popup-close">Close</button>
    `;

    document.body.appendChild(popup);

    const closeButton = popup.querySelector(".popup-close");

    closeButton.addEventListener("click", function () {
        popup.remove();
    });
}

function updateFinancialDisplays() {
    if (cashDisplay) {
        cashDisplay.textContent = `$${cash.toLocaleString()}`;
    }

    if (reputationDisplay) {
        reputationDisplay.textContent = `${reputation}/100`;
    }
}

function createFleetDisplay() {
    if (!currentFleet) {
        return;
    }

    currentFleet.innerHTML = "";

    if (fleet.length === 0) {
        currentFleet.innerHTML = `
            <p class="fleet-empty">
                You currently have no aircraft in your fleet.
            </p>
        `;
        return;
    }

    for (const plane of fleet) {
        const fleetElement = document.createElement("div");
        fleetElement.classList.add("fleet-item");

        fleetElement.innerHTML = `
            <h4 class="fleet-aircraft-name">${plane.registration} - ${plane.variant}</h4>
            <p>Manufacturer: ${plane.manufacturer}</p>
            <p>Capacity: ${plane.seating}</p>
            <p>Range: ${plane.range_km.toLocaleString()} km</p>
        `;

        currentFleet.appendChild(fleetElement);
    }
}

function createRoutesDisplay() {
    if (!routesList) {
        return;
    }

    routesList.innerHTML = "";

    if (flightsList.length === 0) {
        const emptyMessage = document.createElement("p");
        emptyMessage.classList.add("fleet-empty");
        emptyMessage.textContent = "No routes in service.";
        routesList.appendChild(emptyMessage);
        return;
    }

    for (const flight of flightsList) {
        const aircraftData = fleet.find(function (plane) {
            return plane.registration === flight.aircraftRegistration ||
                (!flight.aircraftRegistration && plane.variant === flight.aircraft);
        });
        const route = document.createElement("div");
        route.classList.add("fleet-item");

        const routeTitle = document.createElement("h4");
        routeTitle.classList.add("fleet-aircraft-name");
        routeTitle.textContent = aircraftData?.registration || flight.aircraft;

        const routePath = document.createElement("p");
        routePath.textContent = `${flight.start} -> ${flight.destination}`;

        route.append(routeTitle, routePath);
        routesList.appendChild(route);
    }
}

function processFlights() {
    if (flightsList.length === 0 || airport.length === 0) {
        return;
    }

    const hubCode = localStorage.getItem("hubAirport");
    const hubAirport = findAirport(hubCode);

    if (!hubAirport) {
        return;
    }

    for (const flight of flightsList) {
        const selectedAircraft = fleet.find(function (aircraftData) {
            return aircraftData.registration === flight.aircraftRegistration ||
                (!flight.aircraftRegistration && aircraftData.variant === flight.aircraft);
        });
        const destinationAirport = findAirport(flight.destination);

        if (!selectedAircraft || !destinationAirport) {
            continue;
        }

        const distance = haversine(
            hubAirport.lat,
            hubAirport.lon,
            destinationAirport.lat,
            destinationAirport.lon
        );
        const demandMultiplier = 0.5 + reputation / 100;
        const passengers = Math.floor(
            selectedAircraft.seating * demandMultiplier
        );
        const ticketPrice = Math.max(50, distance * 0.12);
        const revenue = passengers * ticketPrice;
        const profit = Math.round(
            revenue - destinationAirport.landing_fee
        );

        cash += profit;
        reputation += profit >= 0 ? 1 : -1;
        reputation = Math.max(0, Math.min(100, reputation));
    }

    localStorage.setItem("cash", cash);
    localStorage.setItem("reputation", reputation);
    updateFinancialDisplays();
}

async function flightCreate() {
    const startHub = document.querySelector(".startHub");
    const destinationChoice = document.querySelector(".destinationChoice");
    const aircraftChoiceSelect = document.querySelector(".aircraftChoice");

    if (!startHub) return;
    if (!destinationChoice) return;
    if (!aircraftChoiceSelect) return;

    if (airport.length === 0) {
        await loadAirports();
    }

    function loadAirportsDropdown() {
        destinationChoice.innerHTML = "";
        try {
            for (const airportData of airport) {
                const option = document.createElement("option");
                option.value = `${airportData.iata}-${airportData.icao}`;
                option.textContent = `${airportData.iata} - ${airportData.icao} / ${airportData.name}`;
                destinationChoice.appendChild(option);
            }
        } catch (error) {
            console.error("Failed to populate destination options:", error);
        }
    }

    async function loadAircraftDropdown() {
        aircraftChoiceSelect.innerHTML = "";

        if (typeof fleet !== 'undefined' && fleet.length === 0) {
            await loadAircraft();
        }

        if (fleet.length === 0) {
            const option = document.createElement("option");
            option.textContent = "No aircraft available";
            option.disabled = true;
            option.selected = true;
            aircraftChoiceSelect.appendChild(option);
        }

        try {
            for (const item of fleet) {
                const option = document.createElement("option");
                option.value = item.registration;
                option.textContent = `${item.registration} - ${item.variant}`;
                aircraftChoiceSelect.appendChild(option);
            }
        } catch (error) {
            console.error("Aircraft not loaded:", error);
        }
    }

    const hub = localStorage.getItem("hubAirport");
    startHub.textContent = hub;

    const hubAirport = findAirport(hub);
    if (!hubAirport) {
        console.error("Hub airport not found.");
        return;
    }

    function findAircraftByRegistration(registration) {
        return fleet.find(function (aircraftData) {
            return aircraftData.registration === registration;
        });
    }

    loadAirportsDropdown();
    await loadAircraftDropdown();

    flightPlanForm.addEventListener("submit", function (event) {
        event.preventDefault();
        const selectedAircraft = findAircraftByRegistration(aircraftChoiceSelect.value);
        if (!selectedAircraft) {
            customPopup(
                "Flight Plan Error",
                "Purchase an aircraft before creating a flight plan."
            );
            return;
        }

        const aircraftAlreadyAssigned = flightsList.some(function (flight) {
            return flight.aircraftRegistration === selectedAircraft.registration ||
                (!flight.aircraftRegistration && flight.aircraft === selectedAircraft.variant);
        });

        if (aircraftAlreadyAssigned) {
            customPopup(
                "Flight Plan Error",
                `${selectedAircraft.registration} already has a route assigned.`
            );
            return;
        }

        const destinationAirport = findAirport(destinationChoice.value);
        if (!destinationAirport) {
            console.error("Destination airport not found.");
            return;
        }
        if (destinationChoice.value === hub) {

            customPopup(
                "Flight Plan Error",
                "The destination cannot be the same as your hub airport."
            );

            return;

        }

        function checkDistance() {
            const haversineCalculation = haversine(hubAirport.lat, hubAirport.lon, destinationAirport.lat, destinationAirport.lon);
            if (haversineCalculation > selectedAircraft.range_km) {

                customPopup(
                    "Flight Plan Error",
                    "The selected aircraft does not have enough range to reach the destination."
                );

                return false;

            }

            return true;
        }

        if (!checkDistance()) {
            return;
        }

        const flight = new flights(
            selectedAircraft.variant,
            startHub.textContent,
            destinationChoice.value,
            selectedAircraft.registration
        );

        flightsList.push(flight);

        localStorage.setItem("flightsList", JSON.stringify(flightsList));
    });
}

function time() {
    if (!timeDisplay) {
        return;
    }

    const startingDate = "2026-09-06";

    let gameDate = localStorage.getItem("gameDate");

    if (!gameDate) {
        gameDate = startingDate;
        localStorage.setItem("gameDate", gameDate);
    }

    let gamePaused = localStorage.getItem("gamePaused") === "true";

    let lastTimeUpdate = Number(
        localStorage.getItem("lastTimeUpdate")
    );

    if (!lastTimeUpdate) {
        lastTimeUpdate = Date.now();
        localStorage.setItem("lastTimeUpdate", lastTimeUpdate);
    }

    let advanceDayCooldown = Number(
        localStorage.getItem("advanceDayCooldown")
    ) || 0;

    function displayDate() {
        timeDisplay.textContent = gameDate;
    }

    function updatePauseButton() {
        if (!pauseGameButton) {
            return;
        }

        if (gamePaused) {
            pauseGameButton.textContent = "▶ Resume";
        } else {
            pauseGameButton.textContent = "⏸ Pause";
        }
    }

    function updateCooldown() {
        if (!advanceDayButton) {
            return;
        }

        const remainingCooldown =
            Math.max(
                0,
                Math.ceil((advanceDayCooldown - Date.now()) / 1000)
            );

        if (remainingCooldown > 0) {
            advanceDayButton.disabled = true;

            if (advanceDayCooldownDisplay) {
                advanceDayCooldownDisplay.textContent =
                    `${remainingCooldown}s`;
            }
        } else {
            advanceDayButton.disabled = false;

            if (advanceDayCooldownDisplay) {
                advanceDayCooldownDisplay.textContent = "";
            }

            localStorage.removeItem("advanceDayCooldown");
        }
    }

    function advanceGameDate() {
        const date = new Date(`${gameDate}T00:00:00`);

        date.setDate(date.getDate() + 1);

        gameDate = [
            date.getFullYear(),
            String(date.getMonth() + 1).padStart(2, "0"),
            String(date.getDate()).padStart(2, "0")
        ].join("-");

        localStorage.setItem("gameDate", gameDate);

        processFlights();

        displayDate();
    }

    displayDate();
    updatePauseButton();
    updateCooldown();

    if (pauseGameButton) {
        pauseGameButton.addEventListener("click", function () {
            gamePaused = !gamePaused;

            localStorage.setItem(
                "gamePaused",
                gamePaused
            );

            lastTimeUpdate = Date.now();

            localStorage.setItem(
                "lastTimeUpdate",
                lastTimeUpdate
            );

            updatePauseButton();
        });
    }

    if (advanceDayButton) {
        advanceDayButton.addEventListener("click", function () {
            if (advanceDayCooldown > Date.now()) {
                return;
            }

            advanceGameDate();

            advanceDayCooldown = Date.now() + 45000;

            localStorage.setItem(
                "advanceDayCooldown",
                advanceDayCooldown
            );

            updateCooldown();
        });
    }

    setInterval(function () {
        const currentTime = Date.now();

        if (!gamePaused) {
            const elapsedTime =
                currentTime - lastTimeUpdate;

            if (elapsedTime >= 60000) {
                const daysPassed =
                    Math.floor(elapsedTime / 60000);

                for (let i = 0; i < daysPassed; i++) {
                    advanceGameDate();
                }

                lastTimeUpdate += daysPassed * 60000;

                localStorage.setItem(
                    "lastTimeUpdate",
                    lastTimeUpdate
                );
            }
        } else {
            lastTimeUpdate = currentTime;

            localStorage.setItem(
                "lastTimeUpdate",
                lastTimeUpdate
            );
        }

        updateCooldown();
    }, 1000);
}

// Function Calls

if (aircraftCatalogContainer) {
    loadAircraft();
}

if (currentFleet) {
    createFleetDisplay();
}

if (routesList) {
    createRoutesDisplay();
}

if (hubAirportSelect || airlineHubDisplay) {
    loadAirports();
}

if (flightPlanForm) {
    flightCreate();
}

time();