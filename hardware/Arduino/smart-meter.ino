// Arduino Smart Meter Firmware
// ------------------------------------------------------------
// Counts pulses from an optocoupler, displays units on a 16x2 LCD, controls a relay,
// and sends unit values over Serial for ESP8266 bridging.
// ------------------------------------------------------------

#include <LiquidCrystal.h>

// ----- Pin configuration -----
const uint8_t PULSE_PIN = 2;        // Interrupt‑capable pin
const uint8_t RELAY_PIN = 8;        // Relay control
// LCD pins (RS, EN, D4, D5, D6, D7)
const uint8_t LCD_RS = 12;
const uint8_t LCD_EN = 11;
const uint8_t LCD_D4 = 5;
const uint8_t LCD_D5 = 4;
const uint8_t LCD_D6 = 3;
const uint8_t LCD_D7 = 6;

LiquidCrystal lcd(LCD_RS, LCD_EN, LCD_D4, LCD_D5, LCD_D6, LCD_D7);

// ----- Runtime variables -----
volatile unsigned long pulseCount = 0;   // updated in ISR
const float UNITS_PER_PULSE = 0.01;      // 100 pulses = 1 kWh (adjust as needed)
const float THRESHOLD_UNITS = 1.0;      // turn relay off when >= threshold

unsigned long lastPrint = 0;            // millis timer for Serial output
const unsigned long PRINT_INTERVAL = 5000; // 5 s

// ------------------------------------------------------------
void IRAM_ATTR pulseISR() {
  pulseCount++;
}

void setup() {
  pinMode(PULSE_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(PULSE_PIN), pulseISR, FALLING);

  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, LOW); // relay OFF initially (assumes LOW = off)

  lcd.begin(16, 2);
  lcd.print("Units: 0.00");
  lcd.setCursor(0, 1);
  lcd.print("Status: OK   ");

  Serial.begin(115200);
  Serial.println(F("SMART_METER_READY"));
}

void loop() {
  unsigned long now = millis();
  if (now - lastPrint >= PRINT_INTERVAL) {
    float units = pulseCount * UNITS_PER_PULSE;
    // Update LCD
    lcd.setCursor(7, 0);
    lcd.print("      "); // clear
    lcd.setCursor(7, 0);
    lcd.print(units, 2);
    // Relay logic
    if (units >= THRESHOLD_UNITS) {
      digitalWrite(RELAY_PIN, HIGH); // turn load OFF (assumes HIGH disables)
      lcd.setCursor(8, 1);
      lcd.print("OFF");
    } else {
      digitalWrite(RELAY_PIN, LOW);
      lcd.setCursor(8, 1);
      lcd.print("ON ");
    }
    // Serial output for ESP8266
    Serial.print(F("UNITS:"));
    Serial.println(units, 2);
    lastPrint = now;
  }
}
