const cds = require('@sap/cds');

module.exports = cds.service.impl(function () {

    const {
        Shipments,
        TelemetrySignals,
        Products,
        PharmaCompanies,
TransportResources,
ColdStorageFacilities,
StockItems,
RecoveryRequests
    } = this.entities;

    this.on('analyzeShipment', async (req) => {

        const shipmentID = req.data.shipmentID;

        // Get shipment
        const shipment = await SELECT.one
            .from(Shipments)
            .where({ ID: shipmentID });

        if (!shipment) {
            return JSON.stringify({
                error: `Shipment ${shipmentID} not found`
            });
        }

        // Get latest telemetry
        const telemetry = await SELECT.one
            .from(TelemetrySignals)
            .where({ shipment_ID: shipmentID })
            .orderBy('timestamp desc');

        if (!telemetry) {
            return JSON.stringify({
                error: `No telemetry found for ${shipmentID}`
            });
        }

        // Get product
        const product = await SELECT.one
            .from(Products)
            .where({ ID: shipment.product_ID });

        // Get company
        const company = await SELECT.one
            .from(PharmaCompanies)
            .where({ ID: shipment.company_ID });


        // -------------------------
        // SENSING AGENT
        // -------------------------

        const temperature = Number(telemetry.temperature);

        let risk = 'LOW';
        const reasons = [];

        if (temperature > 8) {
            risk = 'HIGH';
            reasons.push('Temperature exceeded the required 2-8°C range');
        }

        if (telemetry.reeferStatus === 'FAILED') {
            risk = 'HIGH';
            reasons.push('Refrigeration unit failure detected');
        }

        if (telemetry.signalStatus === 'CRITICAL') {
            risk = 'HIGH';
            reasons.push('Critical telemetry signal detected');
        }

        if (telemetry.weather === 'HEATWAVE') {
            reasons.push('Heatwave conditions detected');
        }

        if (telemetry.trafficStatus === 'HEAVY') {
            reasons.push('Heavy traffic may increase exposure time');
        }

        if (Number(telemetry.speed) === 0) {
            reasons.push('Vehicle is currently stopped');
        }


        // -------------------------
        // RESPONSE
        // -------------------------

        const result = {

            shipment: {
                id: shipment.ID,
                source: shipment.source,
                destination: shipment.destination,
                quantity: shipment.quantity,
                batch: shipment.batchNumber
            },

            pharmaCompany: company?.name,

            product: {
                id: product?.ID,
                name: product?.name,
                requiredTemperature: product?.requiredTemperature
            },

            sensingAgent: {
                riskLevel: risk,
                currentTemperature: temperature,
                reeferStatus: telemetry.reeferStatus,
                weather: telemetry.weather,
                traffic: telemetry.trafficStatus,
                signalStatus: telemetry.signalStatus,
                reasons
            },

            status: 'ANALYSIS_COMPLETE'
        };

        return JSON.stringify(result, null, 2);
    });
    // -----------------------------------
    // LOGISTICS AGENT
    // -----------------------------------

    this.on('analyzeLogistics', async (req) => {

        const shipmentID = req.data.shipmentID;

        // Get shipment
        const shipment = await SELECT.one
            .from(Shipments)
            .where({ ID: shipmentID });

        if (!shipment) {
            return JSON.stringify({
                error: `Shipment ${shipmentID} not found`
            });
        }

        // Find available transport resources
        const transports = await SELECT
            .from(TransportResources)
            .where({
                status: 'AVAILABLE'
            });

        // Find operational cold-storage facilities
        const coldStorages = await SELECT
            .from(ColdStorageFacilities)
            .where({
                status: 'OPERATIONAL'
            });


        // -----------------------------------
        // FILTER COMPATIBLE TRANSPORT
        // -----------------------------------

        const compatibleTransport = transports.filter(t => {

            const temperatureCompatible =
                t.temperatureRange === shipment.requiredTemp;

            const capacityAvailable =
                Number(t.capacity) >= Number(shipment.quantity);

            return temperatureCompatible && capacityAvailable;
        });


        // -----------------------------------
        // FILTER COLD STORAGE
        // -----------------------------------

        const compatibleColdStorage = coldStorages.filter(cs => {

            const temperatureCompatible =
                cs.temperatureRange === shipment.requiredTemp;

            const capacityAvailable =
                Number(cs.availableSpace) >= Number(shipment.quantity);

            return temperatureCompatible && capacityAvailable;
        });


        // -----------------------------------
        // BUILD RECOVERY OPTIONS
        // -----------------------------------

        const options = [];


        if (compatibleColdStorage.length > 0) {

            options.push({
                option: 'COLD_STORAGE_DIVERSION',
                action: 'DIVERT_TO_QUALIFIED_COLD_STORAGE',
                facilities: compatibleColdStorage.map(cs => ({
                    id: cs.ID,
                    name: cs.name,
                    location: cs.location,
                    availableSpace: cs.availableSpace,
                    temperatureRange: cs.temperatureRange
                }))
            });
        }


        if (compatibleTransport.length > 0) {

            options.push({
                option: 'BACKUP_TRANSPORT',
                action: 'TRANSFER_TO_BACKUP_REFRIGERATED_VEHICLE',
                vehicles: compatibleTransport.map(t => ({
                    id: t.ID,
                    provider: t.provider,
                    vehicleNumber: t.vehicleNumber,
                    capacity: t.capacity,
                    currentLocation: t.currentLocation,
                    temperatureRange: t.temperatureRange
                }))
            });
        }


        // Continuing the route after reefer failure
        // is considered unsafe for this prototype.

        options.push({
            option: 'CONTINUE_CURRENT_ROUTE',
            action: 'CONTINUE_CURRENT_ROUTE',
            status: 'NOT_RECOMMENDED',
            reason: 'Refrigeration failure detected'
        });


        // -----------------------------------
        // RECOMMENDATION
        // -----------------------------------

        let recommendation = 'ESCALATE_FOR_REVIEW';

        if (compatibleColdStorage.length > 0) {

            recommendation =
                'DIVERT_TO_QUALIFIED_COLD_STORAGE';

        } else if (compatibleTransport.length > 0) {

            recommendation =
                'TRANSFER_TO_BACKUP_REFRIGERATED_VEHICLE';
        }


        const result = {

            shipment: {
                id: shipment.ID,
                source: shipment.source,
                destination: shipment.destination,
                quantity: shipment.quantity
            },

            logisticsAgent: {

                currentVehicle: shipment.vehicle_ID,

                availableTransportOptions:
                    compatibleTransport.map(t => ({
                        id: t.ID,
                        vehicleNumber: t.vehicleNumber,
                        provider: t.provider,
                        capacity: t.capacity,
                        location: t.currentLocation
                    })),

                availableColdStorageOptions:
                    compatibleColdStorage.map(cs => ({
                        id: cs.ID,
                        name: cs.name,
                        location: cs.location,
                        availableSpace: cs.availableSpace
                    })),

                recoveryOptions: options,

                recommendation: recommendation
            },

            status: 'LOGISTICS_ANALYSIS_COMPLETE'
        };


        return JSON.stringify(result, null, 2);
    });

this.on('analyzeInventory', async (req) => {

    const shipmentID = req.data.shipmentID;

    // Get shipment
    const shipment = await SELECT.one
        .from(Shipments)
        .where({ ID: shipmentID });

    if (!shipment) {
        return JSON.stringify({
            error: `Shipment ${shipmentID} not found`
        });
    }

    // Find product
    const product = await SELECT.one
        .from(Products)
        .where({ ID: shipment.product_ID });

    if (!product) {
        return JSON.stringify({
            error: `Product ${shipment.product_ID} not found`
        });
    }

    // Find available stock of the same product
    const stock = await SELECT
        .from(StockItems)
        .where({
            product_ID: shipment.product_ID,
            status: 'AVAILABLE'
        });

    // Keep only stock that can cover the requested quantity
    const replacementStock = stock
        .filter(item => item.availableQty >= shipment.quantity)
        .map(item => ({
            id: item.ID,
            batchNumber: item.batchNumber,
            companyID: item.company_ID,
            availableQty: item.availableQty,
            sourceLocation: item.sourceLocation,
            status: item.status
        }));

    let recommendation = 'NO_REPLACEMENT_STOCK';

    if (replacementStock.length > 0) {
        recommendation = 'REPLACEMENT_STOCK_AVAILABLE';
    }

    return JSON.stringify({
        shipment: {
            id: shipment.ID,
            product: product.name,
            requestedQuantity: shipment.quantity,
            source: shipment.source,
            destination: shipment.destination
        },

        inventoryAgent: {
            productID: product.ID,
            requiredTemperature: product.requiredTemperature,

            availableReplacementStock: replacementStock,

            replacementRequiredQuantity: shipment.quantity,

            recommendation: recommendation
        },

        status: 'INVENTORY_ANALYSIS_COMPLETE'
    }, null, 2);
});
this.on('analyzeCompliance', async (req) => {

    const shipmentID = req.data.shipmentID;

    // Get shipment
    const shipment = await SELECT.one
        .from(Shipments)
        .where({ ID: shipmentID });

    if (!shipment) {
        return JSON.stringify({
            error: `Shipment ${shipmentID} not found`
        });
    }

    // Get product requirements
    const product = await SELECT.one
        .from(Products)
        .where({ ID: shipment.product_ID });

    if (!product) {
        return JSON.stringify({
            error: `Product ${shipment.product_ID} not found`
        });
    }

    // Get latest telemetry
    const telemetry = await SELECT.one
        .from(TelemetrySignals)
        .where({ shipment_ID: shipmentID })
        .orderBy('timestamp desc');

    if (!telemetry) {
        return JSON.stringify({
            error: `No telemetry found for ${shipmentID}`
        });
    }

    // Get current vehicle
    const vehicle = await SELECT.one
        .from(TransportResources)
        .where({ ID: shipment.vehicle_ID });

    const requiredTemp = product.requiredTemperature;

    /*
     * Current prototype uses the product requirement "2-8C".
     * Later this can be expanded to structured min/max values.
     */
    const temperatureCompliant =
        telemetry.temperature >= 2 &&
        telemetry.temperature <= 8;

    const transportCompliant =
        vehicle &&
        vehicle.temperatureRange === requiredTemp;

    const refrigerationOperational =
        telemetry.reeferStatus === 'ACTIVE';

    const evidenceChecks = {
        telemetryAvailable: !!telemetry,
        vehicleAvailable: !!vehicle,
        temperatureRecorded: telemetry.temperature !== null,
        refrigerationStatusRecorded: !!telemetry.reeferStatus,
        signalStatusRecorded: !!telemetry.signalStatus
    };

    const evidenceComplete =
        Object.values(evidenceChecks).every(Boolean);

    const complianceIssues = [];

    if (!temperatureCompliant) {
        complianceIssues.push(
            'Shipment temperature is outside the required 2-8C range'
        );
    }

    if (!transportCompliant) {
        complianceIssues.push(
            'Current transport does not match the product temperature requirement'
        );
    }

    if (!refrigerationOperational) {
        complianceIssues.push(
            'Refrigeration system is not operational'
        );
    }

    if (!evidenceComplete) {
        complianceIssues.push(
            'Required operational evidence is incomplete'
        );
    }

    const qualityReviewRequired =
        !temperatureCompliant ||
        !refrigerationOperational ||
        !evidenceComplete;

    let recommendation = 'COMPLIANT';

    if (qualityReviewRequired) {
        recommendation = 'QUALITY_REVIEW_REQUIRED';
    }

    return JSON.stringify({
        shipment: {
            id: shipment.ID,
            product: product.name,
            batchNumber: shipment.batchNumber,
            source: shipment.source,
            destination: shipment.destination,
            quantity: shipment.quantity
        },

        complianceAgent: {
            requiredTemperature: requiredTemp,
            currentTemperature: telemetry.temperature,

            temperatureCompliant: temperatureCompliant,

            transport: {
                vehicleID: shipment.vehicle_ID,
                temperatureRange: vehicle
                    ? vehicle.temperatureRange
                    : null,
                compliant: transportCompliant
            },

            refrigerationOperational:
                refrigerationOperational,

            evidence: evidenceChecks,

            evidenceStatus:
                evidenceComplete
                    ? 'COMPLETE'
                    : 'INCOMPLETE',

            complianceIssues,

            qualityReviewRequired,

            recommendation
        },

        status: 'COMPLIANCE_ANALYSIS_COMPLETE'
    }, null, 2);
});
this.on('createRecoveryReview', async (req) => {

    const shipmentID = req.data.shipmentID;

    // --------------------------------------------------
    // 1. Get shipment
    // --------------------------------------------------
    const shipment = await SELECT.one
        .from(Shipments)
        .where({ ID: shipmentID });

    if (!shipment) {
        return JSON.stringify({
            error: `Shipment ${shipmentID} not found`
        });
    }

    // --------------------------------------------------
    // 2. Get latest telemetry
    // --------------------------------------------------
    const telemetry = await SELECT.one
        .from(TelemetrySignals)
        .where({ shipment_ID: shipmentID })
        .orderBy('timestamp desc');

    // --------------------------------------------------
    // 3. Get product
    // --------------------------------------------------
    const product = await SELECT.one
        .from(Products)
        .where({ ID: shipment.product_ID });

    // --------------------------------------------------
    // 4. SENSING AGENT
    // --------------------------------------------------
    const sensingRisk =
        telemetry &&
        (
            telemetry.temperature > 8 ||
            telemetry.temperature < 2 ||
            telemetry.reeferStatus === 'FAILED' ||
            telemetry.signalStatus === 'CRITICAL'
        );

    const sensingReasons = [];

    if (telemetry) {

        if (telemetry.temperature > 8 ||
            telemetry.temperature < 2) {

            sensingReasons.push(
                `Temperature excursion detected: ${telemetry.temperature}°C`
            );
        }

        if (telemetry.reeferStatus === 'FAILED') {
            sensingReasons.push(
                'Refrigeration failure detected'
            );
        }

        if (telemetry.weather === 'HEATWAVE') {
            sensingReasons.push(
                'Heatwave conditions detected'
            );
        }

        if (telemetry.trafficStatus === 'HEAVY') {
            sensingReasons.push(
                'Heavy traffic may increase exposure time'
            );
        }
    }

    // --------------------------------------------------
    // 5. LOGISTICS AGENT
    // --------------------------------------------------

    const transportOptions = await SELECT
        .from(TransportResources)
        .where({
            status: 'AVAILABLE'
        });

    const storageOptions = await SELECT
        .from(ColdStorageFacilities)
        .where({
            status: 'OPERATIONAL'
        });

    const qualifiedTransport = transportOptions
        .filter(t =>
            t.temperatureRange === shipment.requiredTemp &&
            t.capacity >= shipment.quantity
        )
        .map(t => ({
            id: t.ID,
            provider: t.provider,
            vehicleNumber: t.vehicleNumber,
            capacity: t.capacity,
            currentLocation: t.currentLocation
        }));

    const qualifiedStorage = storageOptions
        .filter(s =>
            s.temperatureRange === shipment.requiredTemp &&
            s.availableSpace >= shipment.quantity
        )
        .map(s => ({
            id: s.ID,
            name: s.name,
            location: s.location,
            availableSpace: s.availableSpace
        }));

    // --------------------------------------------------
    // 6. INVENTORY AGENT
    // --------------------------------------------------

    const replacementStock = await SELECT
        .from(StockItems)
        .where({
            product_ID: shipment.product_ID,
            status: 'AVAILABLE'
        });

    const usableReplacementStock = replacementStock
        .filter(stock =>
            stock.availableQty >= shipment.quantity
        )
        .map(stock => ({
            id: stock.ID,
            batchNumber: stock.batchNumber,
            companyID: stock.company_ID,
            availableQty: stock.availableQty,
            sourceLocation: stock.sourceLocation
        }));

    // --------------------------------------------------
    // 7. COMPLIANCE AGENT
    // --------------------------------------------------

    const temperatureCompliant =
        telemetry &&
        telemetry.temperature >= 2 &&
        telemetry.temperature <= 8;

    const refrigerationOperational =
        telemetry &&
        telemetry.reeferStatus === 'ACTIVE';

    const qualityReviewRequired =
        !temperatureCompliant ||
        !refrigerationOperational;

    // --------------------------------------------------
    // 8. DECISION LOGIC
    // --------------------------------------------------

    let recommendedAction;
    let backupAction;

    if (sensingRisk && qualifiedStorage.length > 0) {

        recommendedAction =
            'DIVERT_TO_QUALIFIED_COLD_STORAGE';

        backupAction =
            qualifiedTransport.length > 0
                ? 'TRANSFER_TO_BACKUP_REFRIGERATED_VEHICLE'
                : 'USE_EMERGENCY_REPLACEMENT_STOCK';

    } else if (sensingRisk && qualifiedTransport.length > 0) {

        recommendedAction =
            'TRANSFER_TO_BACKUP_REFRIGERATED_VEHICLE';

        backupAction =
            usableReplacementStock.length > 0
                ? 'USE_EMERGENCY_REPLACEMENT_STOCK'
                : 'ESCALATE_FOR_REVIEW';

    } else if (!sensingRisk) {

        recommendedAction =
            'CONTINUE_MONITORED_ROUTE';

        backupAction =
            'ENHANCED_MONITORING';

    } else {

        recommendedAction =
            'ESCALATE_FOR_REVIEW';

        backupAction =
            'NO_FEASIBLE_RECOVERY_OPTION';
    }

    // --------------------------------------------------
    // 9. RISK LEVEL
    // --------------------------------------------------

    let riskLevel = 'LOW';

    if (sensingRisk) {
        riskLevel = 'HIGH';
    }

    // --------------------------------------------------
    // 10. HUMAN REVIEW
    // --------------------------------------------------

    const operationsReview = {
        required: true,
        status: 'PENDING',
        decision: null
    };

    const qualityReview = {
        required: qualityReviewRequired,
        status: qualityReviewRequired
            ? 'PENDING'
            : 'NOT_REQUIRED',
        decision: null
    };

    // --------------------------------------------------
    // 11. FINAL REVIEW PACKET
    // --------------------------------------------------

    const reviewPacket = {

        recoveryCase: {
            shipmentID: shipment.ID,
            productID: shipment.product_ID,
            productName: product
                ? product.name
                : null,

            batchNumber: shipment.batchNumber,

            source: shipment.source,
            destination: shipment.destination,

            quantity: shipment.quantity,

            riskLevel: riskLevel,

            status: 'PENDING_HUMAN_APPROVAL'
        },

        incident: {
            temperature: telemetry
                ? telemetry.temperature
                : null,

            requiredTemperature:
                shipment.requiredTemp,

            reeferStatus: telemetry
                ? telemetry.reeferStatus
                : null,

            weather: telemetry
                ? telemetry.weather
                : null,

            traffic: telemetry
                ? telemetry.trafficStatus
                : null,

            reasons: sensingReasons
        },

        agentFindings: {

            sensingAgent: {
                riskDetected: sensingRisk,
                riskLevel: riskLevel,
                reasons: sensingReasons
            },

            logisticsAgent: {
                qualifiedColdStorage:
                    qualifiedStorage,

                qualifiedTransport:
                    qualifiedTransport
            },

            inventoryAgent: {
                replacementStockAvailable:
                    usableReplacementStock.length > 0,

                replacementStock:
                    usableReplacementStock
            },

            complianceAgent: {
                temperatureCompliant:
                    temperatureCompliant,

                refrigerationOperational:
                    refrigerationOperational,

                qualityReviewRequired:
                    qualityReviewRequired
            }
        },

        decision: {

            recommendedAction:
                recommendedAction,

            backupAction:
                backupAction,

            recommendationReason:
                sensingReasons.join('; ')
                || 'No critical risk detected'
        },

        humanApproval: {

            operations: operationsReview,

            quality: qualityReview,

            executionBlocked:
                true
        },

        audit: {

            generatedBy:
                'PharmaResQ Recovery Orchestrator',

            status:
                'REVIEW_PACKET_CREATED'
        }
    };

   // --------------------------------------------------
// Persist recovery case
// --------------------------------------------------

const caseID = `RR${shipment.ID}`;

const existingCase = await SELECT.one
    .from(RecoveryRequests)
    .where({ ID: caseID });

const recoveryRecord = {
    ID: caseID,
    shipment_ID: shipment.ID,
    product_ID: shipment.product_ID,
    source: shipment.source,
    destination: shipment.destination,
    requestedQty: shipment.quantity,
    riskLevel: riskLevel,
    recommendedAction: recommendedAction,
    alternativeAction: backupAction,
    reason: sensingReasons.join('; '),
    status: 'PENDING_HUMAN_APPROVAL',

    operationsStatus: 'PENDING',
    qualityStatus: qualityReviewRequired
        ? 'PENDING'
        : 'NOT_REQUIRED',

    operationsDecision: null,
    qualityDecision: null
};

if (existingCase) {

    await UPDATE(RecoveryRequests)
        .set(recoveryRecord)
        .where({ ID: caseID });

} else {

    await INSERT
        .into(RecoveryRequests)
        .entries(recoveryRecord);
}

// Add case ID to review packet
reviewPacket.recoveryCase.caseID = caseID;

return JSON.stringify(
    reviewPacket,
    null,
    2
);
});
this.on('approveOperations', async (req) => {

    const caseID = req.data.caseID;

    const recoveryCase = await SELECT.one
        .from(RecoveryRequests)
        .where({ ID: caseID });

    if (!recoveryCase) {
        return JSON.stringify({
            error: `Recovery case ${caseID} not found`
        });
    }

    await UPDATE(RecoveryRequests)
        .set({
            operationsStatus: 'APPROVED',
            operationsDecision: 'APPROVE'
        })
        .where({ ID: caseID });

    return JSON.stringify({
        caseID: caseID,
        reviewer: 'OPERATIONS',
        decision: 'APPROVED',
        status: 'OPERATIONS_APPROVED',

        message:
            'Operations has approved the recommended recovery action.'
    }, null, 2);
});
this.on('rejectOperations', async (req) => {

    const caseID = req.data.caseID;

    const recoveryCase = await SELECT.one
        .from(RecoveryRequests)
        .where({ ID: caseID });

    if (!recoveryCase) {
        return JSON.stringify({
            error: `Recovery case ${caseID} not found`
        });
    }

    await UPDATE(RecoveryRequests)
        .set({
            operationsStatus: 'REJECTED',
            operationsDecision: 'REJECT'
        })
        .where({ ID: caseID });

    return JSON.stringify({
        caseID: caseID,
        reviewer: 'OPERATIONS',
        decision: 'REJECTED',
        status: 'OPERATIONS_REJECTED',

        message:
            'Operations rejected the recovery recommendation. Case requires further review.'
    }, null, 2);
});
this.on('approveQuality', async (req) => {

    const caseID = req.data.caseID;

    const recoveryCase = await SELECT.one
        .from(RecoveryRequests)
        .where({ ID: caseID });

    if (!recoveryCase) {
        return JSON.stringify({
            error: `Recovery case ${caseID} not found`
        });
    }

    await UPDATE(RecoveryRequests)
        .set({
            qualityStatus: 'APPROVED',
            qualityDecision: 'APPROVE'
        })
        .where({ ID: caseID });

    return JSON.stringify({
        caseID: caseID,
        reviewer: 'QUALITY',
        decision: 'APPROVED',
        status: 'QUALITY_APPROVED',

        message:
            'Quality has approved the recovery recommendation.'
    }, null, 2);
});
this.on('rejectQuality', async (req) => {

    const caseID = req.data.caseID;

    const recoveryCase = await SELECT.one
        .from(RecoveryRequests)
        .where({ ID: caseID });

    if (!recoveryCase) {
        return JSON.stringify({
            error: `Recovery case ${caseID} not found`
        });
    }

    await UPDATE(RecoveryRequests)
        .set({
            qualityStatus: 'REJECTED',
            qualityDecision: 'REJECT'
        })
        .where({ ID: caseID });

    return JSON.stringify({
        caseID: caseID,
        reviewer: 'QUALITY',
        decision: 'REJECTED',
        status: 'QUALITY_REJECTED',

        message:
            'Quality rejected the recovery recommendation. Product disposition remains under Quality control.'
    }, null, 2);
});
this.on('finalizeRecovery', async (req) => {

    const caseID = req.data.caseID;

    const recoveryCase = await SELECT.one
        .from(RecoveryRequests)
        .where({ ID: caseID });

    if (!recoveryCase) {
        return JSON.stringify({
            error: `Recovery case ${caseID} not found`
        });
    }

    // Any rejection blocks execution
    if (
        recoveryCase.operationsStatus === 'REJECTED' ||
        recoveryCase.qualityStatus === 'REJECTED'
    ) {

        await UPDATE(RecoveryRequests)
            .set({
                status: 'REJECTED_ESCALATED'
            })
            .where({ ID: caseID });

        return JSON.stringify({
            caseID,
            status: 'REJECTED_ESCALATED',
            executionAuthorized: false,
            message:
                'Recovery cannot proceed because a human reviewer rejected the recommendation.'
        }, null, 2);
    }

    // Both approvals are mandatory
    if (
        recoveryCase.operationsStatus !== 'APPROVED' ||
        recoveryCase.qualityStatus !== 'APPROVED'
    ) {

        return JSON.stringify({
            caseID,
            status: 'PENDING_HUMAN_APPROVAL',
            executionAuthorized: false,
            message:
                'Both Operations and Quality approval are required before execution.'
        }, null, 2);
    }

    // Both approvals received
    await UPDATE(RecoveryRequests)
        .set({
            status: 'READY_FOR_EXECUTION'
        })
        .where({ ID: caseID });

    return JSON.stringify({
        caseID,
        status: 'READY_FOR_EXECUTION',
        executionAuthorized: true,

        approvals: {
            operations: 'APPROVED',
            quality: 'APPROVED'
        },

        recommendedAction:
            recoveryCase.recommendedAction,

        message:
            'Both Operations and Quality have approved the recovery. The case is now authorized for the next execution workflow.'
    }, null, 2);
});
// ============================================================
// END-USER RECOVERY ORCHESTRATOR
// ============================================================

this.on('processRecoveryRequest', async (req) => {

    const caseID = req.data.caseID;

    // --------------------------------------------------------
    // 1. Get end-user recovery request
    // --------------------------------------------------------

    const recoveryCase = await SELECT.one
        .from(RecoveryRequests)
        .where({ ID: caseID });

    if (!recoveryCase) {
        return JSON.stringify({
            error: `Recovery request ${caseID} not found`
        }, null, 2);
    }


    // --------------------------------------------------------
    // 2. Get product
    // --------------------------------------------------------

    const product = await SELECT.one
        .from(Products)
        .where({
            ID: recoveryCase.product_ID
        });

    if (!product) {
        return JSON.stringify({
            error:
                `Product ${recoveryCase.product_ID} not found`
        }, null, 2);
    }


    const requestedQty =
        Number(recoveryCase.requestedQty);

    const requiredTemperature =
        product.requiredTemperature;


    // ========================================================
    // SENSING & SCENARIO AGENT
    // ========================================================

    /*
     * End-user requests do not have vehicle telemetry yet.
     *
     * Therefore the Sensing Agent evaluates the delivery
     * scenario rather than inventing a telemetry incident.
     */

    const sensingAgent = {

        scenario: 'PLANNED_DELIVERY',

        riskLevel:
            recoveryCase.riskLevel || 'LOW',

        telemetryAvailable: false,

        temperatureStatus:
            'REQUIRED_RANGE_NOT_YET_MEASURED',

        requiredTemperature:
            requiredTemperature,

        destination:
            recoveryCase.destination,

        source:
            recoveryCase.source,

        quantity:
            requestedQty,

        reasons: [
            'Delivery request received from end user',
            `Product requires ${requiredTemperature} cold-chain conditions`,
            'Live vehicle telemetry will be required after dispatch'
        ]
    };


    // ========================================================
    // LOGISTICS AGENT
    // ========================================================

    const transportResources = await SELECT
        .from(TransportResources)
        .where({
            status: 'AVAILABLE'
        });


    const coldStorageFacilities = await SELECT
        .from(ColdStorageFacilities)
        .where({
            status: 'OPERATIONAL'
        });


    const qualifiedTransport =
        transportResources
            .filter(resource =>
                resource.temperatureRange ===
                    requiredTemperature &&
                Number(resource.capacity) >=
                    requestedQty
            )
            .map(resource => ({
                id: resource.ID,
                provider: resource.provider,
                vehicleNumber:
                    resource.vehicleNumber,
                vehicleType:
                    resource.vehicleType,
                capacity:
                    resource.capacity,
                currentLocation:
                    resource.currentLocation,
                temperatureRange:
                    resource.temperatureRange
            }));


    const qualifiedColdStorage =
        coldStorageFacilities
            .filter(facility =>
                facility.temperatureRange ===
                    requiredTemperature &&
                Number(facility.availableSpace) >=
                    requestedQty
            )
            .map(facility => ({
                id: facility.ID,
                name: facility.name,
                location: facility.location,
                availableSpace:
                    facility.availableSpace,
                temperatureRange:
                    facility.temperatureRange
            }));


    const logisticsAgent = {

        source:
            recoveryCase.source,

        destination:
            recoveryCase.destination,

        qualifiedTransport,

        qualifiedColdStorage,

        transportAvailable:
            qualifiedTransport.length > 0,

        coldStorageAvailable:
            qualifiedColdStorage.length > 0
    };


    // ========================================================
    // INVENTORY AGENT
    // ========================================================

    const stockItems = await SELECT
        .from(StockItems)
        .where({
            product_ID:
                recoveryCase.product_ID,

            status:
                'AVAILABLE'
        });


    const eligibleStock =
        stockItems
            .filter(stock =>
                Number(stock.availableQty) >=
                requestedQty
            )
            .map(stock => ({
                id: stock.ID,
                batchNumber:
                    stock.batchNumber,
                companyID:
                    stock.company_ID,
                availableQty:
                    stock.availableQty,
                sourceLocation:
                    stock.sourceLocation,
                status:
                    stock.status
            }));


    const inventoryAgent = {

        productID:
            recoveryCase.product_ID,

        productName:
            product.name,

        requestedQuantity:
            requestedQty,

        requiredTemperature:
            requiredTemperature,

        replacementStockAvailable:
            eligibleStock.length > 0,

        eligibleStock
    };


    // ========================================================
    // COMPLIANCE AGENT
    // ========================================================

    const transportCompliance =
        qualifiedTransport.length > 0;

    const inventoryCompliance =
        eligibleStock.length > 0;

    const temperatureRequirementAvailable =
        !!requiredTemperature;


    const complianceIssues = [];


    if (!temperatureRequirementAvailable) {

        complianceIssues.push(
            'Product temperature requirement is missing'
        );

    }


    if (!transportCompliance) {

        complianceIssues.push(
            'No qualified refrigerated transport currently available'
        );

    }


    if (!inventoryCompliance) {

        complianceIssues.push(
            'No sufficient replacement stock currently available'
        );

    }


    const complianceAgent = {

        requiredTemperature:
            requiredTemperature,

        transportCompliant:
            transportCompliance,

        inventoryAvailable:
            inventoryCompliance,

        temperatureRequirementRecorded:
            temperatureRequirementAvailable,

        evidenceStatus:
            'PLANNED_DELIVERY',

        complianceIssues,

        qualityReviewRequired:
            complianceIssues.length > 0
    };


    // ========================================================
    // RECOVERY ORCHESTRATOR
    // ========================================================

    let recommendedAction;

    let backupAction;

    let riskLevel = 'LOW';


    /*
     * Scenario 1:
     * Stock + refrigerated transport available.
     */

    if (
        eligibleStock.length > 0 &&
        qualifiedTransport.length > 0
    ) {

        recommendedAction =
            'PROCEED_WITH_AVAILABLE_COLD_CHAIN';

        backupAction =
            qualifiedColdStorage.length > 0
                ? 'USE_QUALIFIED_COLD_STORAGE'
                : 'SOURCE_ALTERNATIVE_REFRIGERATED_TRANSPORT';

    }


    /*
     * Scenario 2:
     * Stock available but transport unavailable.
     */

    else if (
        eligibleStock.length > 0 &&
        qualifiedTransport.length === 0
    ) {

        recommendedAction =
            'SOURCE_REFRIGERATED_TRANSPORT';

        backupAction =
            qualifiedColdStorage.length > 0
                ? 'USE_QUALIFIED_COLD_STORAGE'
                : 'ESCALATE_FOR_REVIEW';

        riskLevel = 'MEDIUM';

    }


    /*
     * Scenario 3:
     * Transport available but inventory unavailable.
     */

    else if (
        eligibleStock.length === 0 &&
        qualifiedTransport.length > 0
    ) {

        recommendedAction =
            'SOURCE_EMERGENCY_REPLACEMENT_STOCK';

        backupAction =
            qualifiedColdStorage.length > 0
                ? 'USE_QUALIFIED_COLD_STORAGE'
                : 'ESCALATE_FOR_REVIEW';

        riskLevel = 'MEDIUM';

    }


    /*
     * Scenario 4:
     * Neither inventory nor transport is available.
     */

    else {

        recommendedAction =
            'ESCALATE_FOR_REVIEW';

        backupAction =
            'NO_FEASIBLE_RECOVERY_OPTION';

        riskLevel = 'HIGH';

    }


    // ========================================================
    // UPDATE RECOVERY CASE
    // ========================================================

    await UPDATE(RecoveryRequests)
        .set({

            riskLevel:
                riskLevel,

            recommendedAction:
                recommendedAction,

            alternativeAction:
                backupAction,

            reason:
                [
                    `Product: ${product.name}`,
                    `Required temperature: ${requiredTemperature}`,
                    `Requested quantity: ${requestedQty}`,
                    `Source: ${recoveryCase.source}`,
                    `Destination: ${recoveryCase.destination}`,
                    `Qualified transport options: ${qualifiedTransport.length}`,
                    `Eligible stock sources: ${eligibleStock.length}`,
                    `Qualified cold-storage facilities: ${qualifiedColdStorage.length}`
                ].join('; '),

            status:
                'PENDING_HUMAN_APPROVAL',

            operationsStatus:
                'PENDING',

            qualityStatus:
                'PENDING'

        })
        .where({
            ID: caseID
        });


    // ========================================================
    // FINAL REVIEW PACKET
    // ========================================================

    const reviewPacket = {

        recoveryCase: {

            caseID,

            productID:
                recoveryCase.product_ID,

            productName:
                product.name,

            requestedQuantity:
                requestedQty,

            source:
                recoveryCase.source,

            destination:
                recoveryCase.destination,

            requiredTemperature,

            riskLevel,

            status:
                'PENDING_HUMAN_APPROVAL'
        },


        agentFindings: {

            sensingAgent,

            logisticsAgent,

            inventoryAgent,

            complianceAgent

        },


        decision: {

            recommendedAction,

            backupAction,

            recommendationReason:
                'Decision generated by the PharmaResQ Recovery Orchestrator from inventory, logistics and compliance evidence.'
        },


        humanApproval: {

            operations: {

                required: true,

                status: 'PENDING',

                decision: null
            },


            quality: {

                required: true,

                status: 'PENDING',

                decision: null
            },


            executionBlocked: true
        },


        audit: {

            generatedBy:
                'PharmaResQ Recovery Orchestrator',

            status:
                'REVIEW_PACKET_CREATED',

            scenario:
                'END_USER_DELIVERY_REQUEST'
        }

    };


    return JSON.stringify(
        reviewPacket,
        null,
        2
    );

});
});

