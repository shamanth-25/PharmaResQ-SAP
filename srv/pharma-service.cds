using pharmareq from '../db/schema';

@path: '/pharma'
service PharmaResQService {

    entity PharmaCompanies as projection on pharmareq.PharmaCompanies;
    entity Products as projection on pharmareq.Products;
    entity StockItems as projection on pharmareq.StockItems;
    entity TransportResources as projection on pharmareq.TransportResources;
    entity ColdStorageFacilities as projection on pharmareq.ColdStorageFacilities;
    entity Shipments as projection on pharmareq.Shipments;
    entity TelemetrySignals as projection on pharmareq.TelemetrySignals;
    entity RecoveryRequests as projection on pharmareq.RecoveryRequests;
 
    action analyzeShipment(shipmentID : String(10)) returns LargeString;
    action analyzeLogistics(shipmentID : String(10)) returns LargeString;
action analyzeInventory(shipmentID : String(10)) returns LargeString;
action analyzeCompliance(shipmentID : String(10)) returns LargeString;
action createRecoveryReview(shipmentID : String(10)) returns LargeString;
action approveOperations(caseID : String(10)) returns LargeString;
action rejectOperations(caseID : String(10)) returns LargeString;

action approveQuality(caseID : String(10)) returns LargeString;
action rejectQuality(caseID : String(10)) returns LargeString;
action finalizeRecovery(caseID : String(10)) returns LargeString;
action processRecoveryRequest(caseID : String(10)) returns LargeString;
}
