#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <MycilaPZEM.h>
#include <Preferences.h>
#include <WiFi.h>

// =====================================================
// ESP32 SMART METER
// REAL PZEM + WIFI + BACKEND + RELAY
// =====================================================

// ==================== WIFI ====================

const char *WIFI_SSID = "MyPhone";
const char *WIFI_PASSWORD = "12345678";

// ==================== BACKEND ====================

const char *SERVER_URL = "http://10.37.118.33:11020/api/live-data";

const char *DEVICE_ID = "ESP32-GRID-NODE-01";

// ==================== RELAY ====================

#define RELAY_PIN 26
#define STATUS_LED 2

// ==================== PZEM ====================

#define PZEM_RX_PIN 16
#define PZEM_TX_PIN 17

Mycila::PZEM pzem;

// ==================== TIMING ====================

const unsigned long SEND_INTERVAL_MS = 2000;
const unsigned long ENERGY_PERSIST_INTERVAL_MS = 60000;

// ==================== ENERGY ====================

Preferences energyStorage;

float accumulatedEnergy = 0.0;

unsigned long lastSendTime = 0;
unsigned long lastEnergySampleTime = 0;
unsigned long lastEnergyPersistTime = 0;

// ==================== REAL PZEM DATA ====================

volatile bool pzemDataAvailable = false;

float realVoltage = NAN;
float realCurrent = NAN;
float realPower = NAN;
float realFrequency = NAN;
float realPowerFactor = NAN;

uint32_t realEnergyWh = 0;

// =====================================================
// SAVE ENERGY
// =====================================================

void persistEnergy() {

  energyStorage.putFloat("totalKwh", accumulatedEnergy);

  Serial.print("[Energy] Saved total: ");
  Serial.print(accumulatedEnergy, 4);
  Serial.println(" kWh");
}

// =====================================================
// PZEM CALLBACK
// =====================================================

void setupPZEM() {

  pzem.begin(Serial2, PZEM_RX_PIN, PZEM_TX_PIN, 0x01, true);

  pzem.setCallback(
      [](const Mycila::PZEM::EventType event, const Mycila::PZEM::Data &data) {
        if (event == Mycila::PZEM::EventType::EVT_READ) {

          realVoltage = data.voltage;

          realCurrent = data.current;

          realPower = data.activePower;

          realFrequency = data.frequency;

          realPowerFactor = data.powerFactor;

          realEnergyWh = data.activeEnergy;

          pzemDataAvailable = true;

          Serial.println();
          Serial.println("[PZEM] REAL READING");

          Serial.print("Voltage     : ");
          Serial.print(realVoltage, 2);
          Serial.println(" V");

          Serial.print("Current     : ");
          Serial.print(realCurrent, 3);
          Serial.println(" A");

          Serial.print("Power       : ");
          Serial.print(realPower, 2);
          Serial.println(" W");

          Serial.print("Energy      : ");
          Serial.print(realEnergyWh);
          Serial.println(" Wh");

          Serial.print("Frequency   : ");
          Serial.print(realFrequency, 2);
          Serial.println(" Hz");

          Serial.print("Power Factor: ");
          Serial.println(realPowerFactor, 2);
        }
      });

  Serial.println("[PZEM] Started");
}

// =====================================================
// SETUP
// =====================================================

void setup() {

  Serial.begin(115200);

  delay(1000);

  Serial.println();
  Serial.println("========================================");
  Serial.println("   ESP32 SMART METER - REAL PZEM");
  Serial.println("========================================");

  // Relay
  pinMode(RELAY_PIN, OUTPUT);

  // Default relay ON
  digitalWrite(RELAY_PIN, HIGH);

  // Status LED
  pinMode(STATUS_LED, OUTPUT);

  digitalWrite(STATUS_LED, LOW);

  // Energy storage
  energyStorage.begin("energy", false);

  accumulatedEnergy = energyStorage.getFloat("totalKwh", 0.0f);

  Serial.print("[Energy] Restored total: ");
  Serial.print(accumulatedEnergy, 4);
  Serial.println(" kWh");

  // Start PZEM
  setupPZEM();

  // WiFi
  connectWiFi();

  lastEnergySampleTime = millis();
  lastEnergyPersistTime = millis();
}

// =====================================================
// LOOP
// =====================================================

void loop() {

  if (WiFi.status() != WL_CONNECTED) {

    connectWiFi();
  }

  unsigned long now = millis();

  if (now - lastSendTime >= SEND_INTERVAL_MS) {

    lastSendTime = now;

    readAndTransmitTelemetry();
  }

  delay(10);
}

// =====================================================
// WIFI
// =====================================================

void connectWiFi() {

  if (WiFi.status() == WL_CONNECTED) {

    return;
  }

  Serial.println();
  Serial.print("[WiFi] Connecting to: ");

  Serial.println(WIFI_SSID);

  WiFi.disconnect(true);

  delay(500);

  WiFi.mode(WIFI_STA);

  WiFi.setAutoReconnect(true);

  WiFi.setSleep(false);

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;

  while (WiFi.status() != WL_CONNECTED && attempts < 30) {

    delay(500);

    Serial.print(".");

    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {

    Serial.println();

    Serial.println("[WiFi] Connected successfully!");

    Serial.print("[WiFi] ESP32 IP Address: ");

    Serial.println(WiFi.localIP());

    Serial.print("[HTTP] Server URL: ");

    Serial.println(SERVER_URL);

    digitalWrite(STATUS_LED, HIGH);

  } else {

    Serial.println();

    Serial.println("[WiFi] Connection failed");

    digitalWrite(STATUS_LED, LOW);
  }
}

// =====================================================
// TELEMETRY
// =====================================================

void readAndTransmitTelemetry() {

  if (WiFi.status() != WL_CONNECTED) {

    Serial.println("[HTTP] WiFi not connected");

    return;
  }

  // ---------------------------------------------------
  // Check PZEM data
  // ---------------------------------------------------

  if (!pzemDataAvailable) {

    Serial.println("[PZEM] Waiting for real data...");

    return;
  }

  // ---------------------------------------------------
  // Copy latest PZEM values
  // ---------------------------------------------------

  float voltage = realVoltage;

  float current = realCurrent;

  float power = realPower;

  float frequency = realFrequency;

  float powerFactor = realPowerFactor;

  // ---------------------------------------------------
  // Validate
  // ---------------------------------------------------

  if (isnan(voltage) || isnan(current) || isnan(power) || isnan(frequency) ||
      isnan(powerFactor)) {

    Serial.println("[PZEM] Invalid reading");

    return;
  }

  // ---------------------------------------------------
  // Energy calculation
  // ---------------------------------------------------

  unsigned long now = millis();

  float elapsedHours = (now - lastEnergySampleTime) / 3600000.0f;

  if (power > 0.0f && elapsedHours > 0.0f) {

    accumulatedEnergy += (power * elapsedHours) / 1000.0f;
  }

  lastEnergySampleTime = now;

  // Save energy
  if (now - lastEnergyPersistTime >= ENERGY_PERSIST_INTERVAL_MS) {

    persistEnergy();

    lastEnergyPersistTime = now;
  }

  // ---------------------------------------------------
  // JSON
  // ---------------------------------------------------

  StaticJsonDocument<256> doc;

  doc["deviceId"] = DEVICE_ID;

  doc["voltage"] = voltage;

  doc["current"] = current;

  doc["power"] = power;

  doc["energy"] = accumulatedEnergy;

  doc["frequency"] = frequency;

  doc["powerFactor"] = powerFactor;

  String jsonPayload;

  serializeJson(doc, jsonPayload);

  // ---------------------------------------------------
  // Serial
  // ---------------------------------------------------

  Serial.println();
  Serial.println("----------------------------------------");

  Serial.print("[HTTP] Sending REAL PZEM data: ");

  Serial.println(jsonPayload);

  Serial.print("[HTTP] Target URL: ");

  Serial.println(SERVER_URL);

  // ---------------------------------------------------
  // HTTP
  // ---------------------------------------------------

  HTTPClient http;

  http.begin(SERVER_URL);

  http.addHeader("Content-Type", "application/json");

  int httpCode = http.POST(jsonPayload);

  // ---------------------------------------------------
  // Response
  // ---------------------------------------------------

  if (httpCode > 0) {

    String response = http.getString();

    Serial.printf("[HTTP] Response code: %d | Body: %s\n", httpCode,
                  response.c_str());

    // -------------------------------------------------
    // Relay control
    // -------------------------------------------------

    StaticJsonDocument<256> respDoc;

    DeserializationError error = deserializeJson(respDoc, response);

    if (!error) {

      const char *relayControl = respDoc["relayControl"] | "ON";

      if (strcmp(relayControl, "OFF") == 0) {

        digitalWrite(RELAY_PIN, LOW);

        Serial.println("[RELAY] OFF - Server command");

      } else {

        digitalWrite(RELAY_PIN, HIGH);

        Serial.println("[RELAY] ON - Server allowed load");
      }
    }

  } else {

    Serial.printf("[HTTP] POST failed: %s\n",
                  http.errorToString(httpCode).c_str());
  }

  http.end();
}