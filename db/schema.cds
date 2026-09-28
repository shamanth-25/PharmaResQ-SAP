namespace pharmareq;

entity PharmaCompanies {
    key ID       : String(10);
        name     : String(100);
        email    : String(150);
        location : String(150);
}

entity Products {
    key ID                  : String(10);
        name                : String(150);
        category            : String(100);
        requiredTemperature : String(50);
        description         : String(500);
}

entity StockItems {
    key ID            : String(10);
        product_ID     : String(10);
        company_ID     : String(10);
        batchNumber    : String(100);
        quantity       : Integer;
        availableQty   : Integer;
        sourceLocation : String(150);
        status          : String(50);
}

entity TransportResources {
    key ID                : String(10);
        provider          : String(150);
        vehicleNumber     : String(100);
        vehicleType       : String(100);
        temperatureRange  : String(50);
        capacity          : Integer;
        currentLocation   : String(150);
        status            : String(50);
}

entity ColdStorageFacilities {
    key ID              : String(10);
        name            : String(150);
        location        : String(150);
        capacity        : Integer;
        availableSpace  : Integer;
        temperatureRange: String(50);
        status          : String(50);
}

entity Shipments {
    key ID              : String(10);
        product_ID      : String(10);
        company_ID      : String(10);
        batchNumber     : String(100);
        source          : String(150);
        destination     : String(150);
        quantity        : Integer;
        vehicle_ID      : String(10);
        requiredTemp    : String(50);
        currentTemp     : Decimal(5,2);
        etaMinutes      : Integer;
        status          : String(50);
}

entity TelemetrySignals {
    key ID              : String(10);
        shipment_ID     : String(10);
        vehicle_ID      : String(10);
        timestamp       : Timestamp;
        temperature     : Decimal(5,2);
        humidity        : Decimal(5,2);
        latitude        : Decimal(9,6);
        longitude       : Decimal(9,6);
        speed           : Decimal(6,2);
        reeferStatus    : String(50);
        doorStatus      : String(50);
        fuelLevel       : Decimal(5,2);
        batteryLevel    : Decimal(5,2);
        weather         : String(100);
        trafficStatus   : String(100);
        signalStatus    : String(50);
}

entity RecoveryRequests {
    key ID                 : String(10);
        shipment_ID        : String(10);
        product_ID         : String(10);
        source              : String(150);
        destination         : String(150);
        requestedQty        : Integer;
        riskLevel           : String(50);
        recommendedAction   : String(200);
        alternativeAction   : String(200);
        reason              : String(500);
        status              : String(50);

        operationsStatus    : String(30);
        qualityStatus       : String(30);
        operationsDecision  : String(50);
        qualityDecision     : String(50);
}
