import { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Thermometer,
  Truck,
  Package,
  ShieldCheck,
  MapPin,
  Clock,
  RefreshCw,
  ChevronRight,
  Battery,
  Fuel,
  CloudSun,
  Route,
  UserCheck,
  Search,
  Building2,
  Warehouse,
  ArrowRight,
  Navigation,
  ClipboardCheck
} from 'lucide-react';

import './App.css';

const API = '/pharma';

function App() {
  const [activeView, setActiveView] = useState('operations');

  const [cases, setCases] = useState([]);
  const [selectedCase, setSelectedCase] = useState(null);

  const [shipment, setShipment] = useState(null);
  const [telemetry, setTelemetry] = useState(null);
  const [product, setProduct] = useState(null);

  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [message, setMessage] = useState('');

  async function loadCases() {
    try {
      setLoading(true);

      const response = await fetch(`${API}/RecoveryRequests`);

      if (!response.ok) {
        throw new Error(
          `Failed to load recovery cases: ${response.status}`
        );
      }

      const data = await response.json();

      const loadedCases = data.value || [];

      setCases(loadedCases);

      if (loadedCases.length > 0) {
        const current =
          loadedCases.find(
            item => item.ID === selectedCase?.ID
          ) || loadedCases[loadedCases.length - 1];

        setSelectedCase(current);

        await loadCaseDetails(current);
      } else {
        setSelectedCase(null);
        setShipment(null);
        setTelemetry(null);
        setProduct(null);
      }

    } catch (error) {
      console.error(error);

      setMessage(
        'Unable to load recovery cases from SAP CAP.'
      );

    } finally {
      setLoading(false);
    }
  }


  /*
   * ==========================================================
   * LOAD CASE DETAILS
   *
   * Supports both:
   *
   * 1. Shipment-based incident cases
   *    RR01 -> SH01 -> telemetry
   *
   * 2. End-user planned delivery cases
   *    REQxxxx -> USRxxxx -> no shipment yet
   *
   * ==========================================================
   */

  async function loadCaseDetails(recoveryCase) {

    if (!recoveryCase) return;

    try {

      setDetailsLoading(true);

      setShipment(null);
      setTelemetry(null);
      setProduct(null);


      /*
       * ------------------------------------------------------
       * First load product directly from RecoveryRequest.
       *
       * This works for both shipment and end-user cases.
       * ------------------------------------------------------
       */

      if (recoveryCase.product_ID) {

        try {

          const productResponse =
            await fetch(
              `${API}/Products('${recoveryCase.product_ID}')`
            );

          if (productResponse.ok) {

            const productData =
              await productResponse.json();

            setProduct(productData);

          }

        } catch (error) {

          console.warn(
            'Unable to load product:',
            error
          );

        }

      }


      /*
       * ------------------------------------------------------
       * Try to load the shipment.
       *
       * End-user requests intentionally don't have a
       * corresponding Shipment record before dispatch.
       * ------------------------------------------------------
       */

      if (recoveryCase.shipment_ID) {

        try {

          const shipmentResponse =
            await fetch(
              `${API}/Shipments('${recoveryCase.shipment_ID}')`
            );


          if (shipmentResponse.ok) {

            const shipmentData =
              await shipmentResponse.json();

            /*
             * CAP may return an OData error object instead
             * of a shipment.
             */

            if (!shipmentData.error) {

              setShipment(shipmentData);


              /*
               * If the shipment gives us a product ID,
               * refresh product using the shipment product.
               */

              if (
                shipmentData.product_ID &&
                shipmentData.product_ID !==
                  recoveryCase.product_ID
              ) {

                try {

                  const productResponse =
                    await fetch(
                      `${API}/Products('${shipmentData.product_ID}')`
                    );

                  if (productResponse.ok) {

                    const productData =
                      await productResponse.json();

                    setProduct(productData);

                  }

                } catch (error) {

                  console.warn(
                    'Unable to load shipment product:',
                    error
                  );

                }

              }


              /*
               * ------------------------------------------------
               * Load latest telemetry only when a real shipment
               * exists.
               * ------------------------------------------------
               */

              const telemetryResponse =
                await fetch(
                  `${API}/TelemetrySignals?$filter=shipment_ID%20eq%20'${recoveryCase.shipment_ID}'&$orderby=timestamp%20desc&$top=1`
                );


              if (telemetryResponse.ok) {

                const telemetryData =
                  await telemetryResponse.json();

                setTelemetry(
                  telemetryData.value?.[0] || null
                );

              }

            }

          }

        } catch (error) {

          /*
           * This is expected for end-user cases because
           * USRxxxx does not exist in Shipments yet.
           */

          console.log(
            `No shipment record for ${recoveryCase.shipment_ID}.`
          );

        }

      }

    } catch (error) {

      console.error(
        'Unable to load case details:',
        error
      );

      setShipment(null);
      setTelemetry(null);

    } finally {

      setDetailsLoading(false);

    }

  }


  useEffect(() => {
    loadCases();
  }, []);


  /*
   * ==========================================================
   * OPERATIONS APPROVAL
   * ==========================================================
   */

  async function approveOperations() {

    if (!selectedCase) return;

    try {

      const response =
        await fetch(
          `${API}/approveOperations`,
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json'
            },

            body:
              JSON.stringify({
                caseID:
                  selectedCase.ID
              })
          }
        );


      if (!response.ok) {

        const error =
          await response.text();

        throw new Error(error);

      }


      setMessage(
        'Operations approval recorded.'
      );

      await loadCases();

    } catch (error) {

      console.error(error);

      setMessage(
        'Operations approval failed.'
      );

    }

  }


  /*
   * ==========================================================
   * QUALITY APPROVAL
   * ==========================================================
   */

  async function approveQuality() {

    if (!selectedCase) return;

    try {

      const response =
        await fetch(
          `${API}/approveQuality`,
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json'
            },

            body:
              JSON.stringify({
                caseID:
                  selectedCase.ID
              })
          }
        );


      if (!response.ok) {

        const error =
          await response.text();

        throw new Error(error);

      }


      setMessage(
        'Quality approval recorded.'
      );

      await loadCases();

    } catch (error) {

      console.error(error);

      setMessage(
        'Quality approval failed.'
      );

    }

  }


  /*
   * ==========================================================
   * FINALIZE RECOVERY
   * ==========================================================
   */

  async function finalizeRecovery() {

    if (!selectedCase) return;

    try {

      const response =
        await fetch(
          `${API}/finalizeRecovery`,
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json'
            },

            body:
              JSON.stringify({
                caseID:
                  selectedCase.ID
              })
          }
        );


      if (!response.ok) {

        const error =
          await response.text();

        throw new Error(error);

      }


      const result =
        await response.json();


      let finalMessage =
        'Recovery finalized.';


      if (result.value) {

        try {

          const parsed =
            typeof result.value === 'string'
              ? JSON.parse(result.value)
              : result.value;


          finalMessage =
            parsed.message ||
            parsed.status ||
            finalMessage;

        } catch {

          finalMessage =
            result.value;

        }

      }


      setMessage(finalMessage);

      await loadCases();

    } catch (error) {

      console.error(error);

      setMessage(
        'Recovery finalization failed.'
      );

    }

  }


  const activeCase =
    selectedCase || cases[0];


  const highRiskCount =
    cases.filter(
      item =>
        item.riskLevel === 'HIGH'
    ).length;


  const pendingReviewCount =
    cases.filter(
      item =>
        item.operationsStatus === 'PENDING' ||
        item.qualityStatus === 'PENDING'
    ).length;


  const readyCount =
    cases.filter(
      item =>
        item.status ===
        'READY_FOR_EXECUTION'
    ).length;


  if (loading) {

    return (

      <div className="loading-screen">

        <Activity size={32} />

        <span>
          Loading PharmaResQ...
        </span>

      </div>

    );

  }


  return (

    <div className="app">


      {/* ======================================================
          TOP BAR
      ======================================================= */}

      <header className="topbar">

        <div className="brand">

          <div className="brand-icon">
            <ShieldCheck size={25} />
          </div>

          <div>

            <h1>
              PharmaResQ
            </h1>

            <span>
              Cold Chain Recovery Control Center
            </span>

          </div>

        </div>


        <div className="live-status">

          <span className="live-dot"></span>

          LIVE OPERATIONS

        </div>

      </header>


      {/* ======================================================
          NAVIGATION
      ======================================================= */}

      <nav className="nav">

        <button
          className={
            activeView === 'operations'
              ? 'nav-active'
              : ''
          }

          onClick={() =>
            setActiveView('operations')
          }
        >
          Operations Control
        </button>


        <button
          className={
            activeView === 'enduser'
              ? 'nav-active'
              : ''
          }

          onClick={() =>
            setActiveView('enduser')
          }
        >
          End User View
        </button>

      </nav>


      {/* ======================================================
          VIEW
      ======================================================= */}

      {activeView === 'operations' ? (

        <OperationsView

          cases={cases}

          activeCase={activeCase}

          selectedCase={selectedCase}

          setSelectedCase={setSelectedCase}

          loadCaseDetails={loadCaseDetails}

          shipment={shipment}

          telemetry={telemetry}

          product={product}

          detailsLoading={detailsLoading}

          highRiskCount={highRiskCount}

          pendingReviewCount={
            pendingReviewCount
          }

          readyCount={readyCount}

          loadCases={loadCases}

          approveOperations={
            approveOperations
          }

          approveQuality={
            approveQuality
          }

          finalizeRecovery={
            finalizeRecovery
          }

          message={message}

        />

      ) : (

        <EndUserView
          setMessage={setMessage}
          loadCases={loadCases}
          setActiveView={setActiveView}
        />

      )}

    </div>

  );
}


/* ============================================================
   OPERATIONS VIEW
============================================================ */

function OperationsView({

  cases,

  activeCase,

  selectedCase,

  setSelectedCase,

  loadCaseDetails,

  shipment,

  telemetry,

  product,

  detailsLoading,

  highRiskCount,

  pendingReviewCount,

  readyCount,

  loadCases,

  approveOperations,

  approveQuality,

  finalizeRecovery,

  message

}) {

  /*
   * Determine whether the current case is an
   * end-user planned delivery.
   */

  const isPlannedDelivery =
    activeCase?.ID?.startsWith('REQ');


  return (

    <main className="main">


      {/* ======================================================
          PAGE HEADING
      ======================================================= */}

      <div className="page-heading">

        <div>

          <h2>
            Recovery Operations
          </h2>

          <p>
            AI-assisted pharmaceutical
            cold-chain recovery with
            human approval.
          </p>

        </div>


        <button
          className="refresh"
          onClick={loadCases}
        >

          <RefreshCw size={17} />

          Refresh

        </button>

      </div>


      {/* ======================================================
          KPI
      ======================================================= */}

      <section className="kpi-grid">

        <Kpi
          icon={<Truck size={21} />}
          label="Active Shipments"
          value={cases.length}
          type="blue"
        />


        <Kpi
          icon={
            <AlertTriangle size={21} />
          }
          label="High Risk Cases"
          value={highRiskCount}
          type="red"
        />


        <Kpi
          icon={<Clock size={21} />}
          label="Pending Reviews"
          value={pendingReviewCount}
          type="orange"
        />


        <Kpi
          icon={
            <CheckCircle size={21} />
          }
          label="Ready for Execution"
          value={readyCount}
          type="green"
        />

      </section>


      {/* ======================================================
          CONTENT
      ======================================================= */}

      <div className="content-grid">


        {/* ====================================================
            CASE LIST
        ===================================================== */}

        <section className="case-panel">

          <div className="panel-header">

            <h3>
              Recovery Cases
            </h3>

            <span>
              {cases.length} cases
            </span>

          </div>


          <div className="case-list">

            {cases.map(item => (

              <button

                key={item.ID}

                className={
                  `case-item ${
                    activeCase?.ID === item.ID
                      ? 'selected'
                      : ''
                  }`
                }

                onClick={() => {

                  setSelectedCase(item);

                  loadCaseDetails(item);

                }}

              >

                <span
                  className={
                    item.riskLevel ===
                    'HIGH'

                      ? 'risk-high'

                      : item.riskLevel ===
                        'MEDIUM'

                        ? 'risk-medium'

                        : 'risk-low'
                  }
                >

                  {item.riskLevel}

                </span>


                <div className="case-info">

                  <strong>
                    {item.ID}
                  </strong>


                  <span>

                    {item.source}

                    <ChevronRight
                      size={13}
                    />

                    {item.destination}

                  </span>


                  <small>
                    {formatAction(
                      item.recommendedAction
                    )}
                  </small>

                </div>


                <ChevronRight
                  size={17}
                />

              </button>

            ))}

          </div>

        </section>


        {/* ====================================================
            DETAIL PANEL
        ===================================================== */}

        {activeCase && (

          <section className="detail-panel">


            {/* ==================================================
                HEADER
            =================================================== */}

            <div className="detail-header">

              <div>

                <div className="case-title">

                  <span
                    className={
                      activeCase.riskLevel ===
                      'HIGH'

                        ? 'risk-high'

                        : activeCase.riskLevel ===
                          'MEDIUM'

                          ? 'risk-medium'

                          : 'risk-low'
                    }
                  >

                    {activeCase.riskLevel}
                    {' '}RISK

                  </span>


                  <h2>
                    Recovery Case {
                      activeCase.ID
                    }
                  </h2>

                </div>


                <p>

                  {isPlannedDelivery
                    ? 'End-user planned delivery request'
                    : `Shipment ${activeCase.shipment_ID}`}

                </p>

              </div>


              <span className="status-badge">

                {activeCase.status}

              </span>

            </div>


            {/* ==================================================
                SHIPMENT / REQUEST
            =================================================== */}

            <div className="section">

              <h3>

                <Package size={18} />

                {isPlannedDelivery
                  ? 'Delivery Request'
                  : 'Shipment'}

              </h3>


              {detailsLoading ? (

                <div className="details-loading">

                  Loading shipment
                  intelligence...

                </div>

              ) : (

                <div className="shipment-grid">


                  <Info

                    label="Product"

                    value={
                      product?.name ||
                      activeCase.product_ID
                    }

                  />


                  <Info

                    label="Batch"

                    value={
                      shipment?.batchNumber ||
                      'Pre-dispatch'
                    }

                  />


                  <Info

                    label="Quantity"

                    value={
                      `${
                        shipment?.quantity ||
                        activeCase.requestedQty
                      } units`
                    }

                  />


                  <Info

                    label="ETA"

                    value={
                      shipment?.etaMinutes
                        ? `${shipment.etaMinutes} min`
                        : 'Not dispatched'
                    }

                  />


                  <Info

                    label="Source"

                    value={
                      shipment?.source ||
                      activeCase.source
                    }

                    icon={
                      <MapPin size={15} />
                    }

                  />


                  <Info

                    label="Destination"

                    value={
                      shipment?.destination ||
                      activeCase.destination
                    }

                    icon={
                      <MapPin size={15} />
                    }

                  />


                  <Info

                    label="Vehicle"

                    value={
                      shipment?.vehicle_ID ||
                      'Not assigned'
                    }

                    icon={
                      <Truck size={15} />
                    }

                  />


                  <Info

                    label="Requirement"

                    value={
                      shipment?.requiredTemp ||
                      product?.requiredTemperature ||
                      '—'
                    }

                    icon={
                      <Thermometer
                        size={15}
                      />
                    }

                  />

                </div>

              )}

            </div>


            {/* ==================================================
                PLANNED DELIVERY NOTICE
            =================================================== */}

            {isPlannedDelivery &&
              !telemetry && (

              <div className="section">

                <div className="incident-heading">

                  <div>

                    <h3>

                      <Navigation
                        size={18}
                      />

                      Pre-Dispatch Scenario

                    </h3>

                    <span
                      className="incident-subtitle"
                    >
                      This request has not
                      been dispatched yet.
                    </span>

                  </div>


                  <span
                    className="status-badge"
                  >
                    PLANNED DELIVERY
                  </span>

                </div>


                <div
                  className="delivery-plan"
                >

                  <div
                    className="delivery-plan-icon"
                  >
                    <Thermometer
                      size={22}
                    />
                  </div>


                  <div
                    className="delivery-plan-content"
                  >

                    <span>
                      TELEMETRY STATUS
                    </span>

                    <h3>
                      Live vehicle telemetry
                      will begin after dispatch
                    </h3>

                    <p>
                      PharmaResQ does not
                      invent temperature or
                      vehicle readings before
                      a transport resource is
                      assigned. The current
                      recommendation is based
                      on available inventory,
                      qualified transport and
                      cold-storage resources.
                    </p>

                  </div>

                </div>

              </div>

            )}


            {/* ==================================================
                LIVE TELEMETRY
            =================================================== */}

            {telemetry && (

              <div className="section">

                <div className="incident-heading">

                  <div>

                    <h3>

                      <Activity size={18} />

                      Live Incident Signals

                    </h3>


                    <span
                      className="incident-subtitle"
                    >

                      Latest telemetry from
                      vehicle{' '}

                      {telemetry.vehicle_ID}

                    </span>

                  </div>


                  <span
                    className="critical-badge"
                  >

                    {
                      telemetry.signalStatus ===
                      'CRITICAL'

                        ? 'CRITICAL SIGNAL'

                        : 'LIVE SIGNAL'
                    }

                  </span>

                </div>


                <div
                  className="telemetry-grid"
                >


                  <TelemetryCard

                    label="Temperature"

                    value={
                      `${telemetry.temperature}°C`
                    }

                    status={
                      Number(
                        telemetry.temperature
                      ) > 8

                        ? 'OUT OF RANGE'

                        : 'IN RANGE'
                    }

                    critical={
                      Number(
                        telemetry.temperature
                      ) > 8
                    }

                    icon={
                      <Thermometer
                        size={17}
                      />
                    }

                  />


                  <TelemetryCard

                    label="Required Range"

                    value={
                      shipment?.requiredTemp ||
                      product?.requiredTemperature ||
                      '2-8C'
                    }

                    status="PRODUCT REQUIREMENT"

                    icon={
                      <Package
                        size={17}
                      />
                    }

                  />


                  <TelemetryCard

                    label="Reefer"

                    value={
                      telemetry.reeferStatus
                    }

                    status={
                      telemetry.reeferStatus ===
                      'FAILED'

                        ? 'FAILURE'

                        : 'OPERATIONAL'
                    }

                    critical={
                      telemetry.reeferStatus ===
                      'FAILED'
                    }

                    icon={
                      <Truck
                        size={17}
                      />
                    }

                  />


                  <TelemetryCard

                    label="Vehicle Speed"

                    value={
                      `${telemetry.speed} km/h`
                    }

                    status={
                      Number(
                        telemetry.speed
                      ) === 0

                        ? 'STOPPED'

                        : 'MOVING'
                    }

                    critical={
                      Number(
                        telemetry.speed
                      ) === 0
                    }

                    icon={
                      <Route
                        size={17}
                      />
                    }

                  />


                  <TelemetryCard

                    label="Weather"

                    value={
                      telemetry.weather
                    }

                    status={
                      telemetry.weather ===
                      'HEATWAVE'

                        ? 'RISK'

                        : 'NORMAL'
                    }

                    critical={
                      telemetry.weather ===
                      'HEATWAVE'
                    }

                    icon={
                      <CloudSun
                        size={17}
                      />
                    }

                  />


                  <TelemetryCard

                    label="Traffic"

                    value={
                      telemetry.trafficStatus
                    }

                    status={
                      telemetry.trafficStatus ===
                      'HEAVY'

                        ? 'DELAY RISK'

                        : 'NORMAL'
                    }

                    critical={
                      telemetry.trafficStatus ===
                      'HEAVY'
                    }

                    icon={
                      <Route
                        size={17}
                      />
                    }

                  />


                  <TelemetryCard

                    label="Fuel"

                    value={
                      `${telemetry.fuelLevel}%`
                    }

                    status="AVAILABLE"

                    icon={
                      <Fuel
                        size={17}
                      />
                    }

                  />


                  <TelemetryCard

                    label="Battery"

                    value={
                      `${telemetry.batteryLevel}%`
                    }

                    status="AVAILABLE"

                    icon={
                      <Battery
                        size={17}
                      />
                    }

                  />

                </div>

              </div>

            )}


            {/* ==================================================
                RECOMMENDATION
            =================================================== */}

            <div className="recommendation">

              <div
                className="recommendation-icon"
              >
                <Truck size={24} />
              </div>


              <div>

                <span>
                  AI RECOVERY RECOMMENDATION
                </span>


                <h2>

                  {formatAction(
                    activeCase.recommendedAction
                  )}

                </h2>


                <p>
                  {activeCase.reason}
                </p>


                <div
                  className="backup-action"
                >

                  <strong>
                    Backup option:
                  </strong>

                  {' '}

                  {formatAction(
                    activeCase.alternativeAction
                  )}

                </div>

              </div>

            </div>


            {/* ==================================================
                AI AGENTS
            =================================================== */}

            <div className="section">

              <h3>

                <Activity size={18} />

                AI Agent Findings

              </h3>


              <div className="agent-grid">


                <Agent

                  name="Sensing & Scenario Agent"

                  icon={
                    <Thermometer
                      size={19}
                    />
                  }

                  status={
                    isPlannedDelivery

                      ? 'PLANNED DELIVERY'

                      : activeCase.riskLevel ===
                        'HIGH'

                        ? 'HIGH RISK'

                        : 'MONITORING'
                  }

                />


                <Agent

                  name="Logistics Agent"

                  icon={
                    <Truck size={19} />
                  }

                  status={
                    activeCase.recommendedAction ===
                    'ESCALATE_FOR_REVIEW'

                      ? 'NO FEASIBLE OPTION'

                      : 'RESOURCES FOUND'
                  }

                />


                <Agent

                  name="Inventory Agent"

                  icon={
                    <Package
                      size={19}
                    />
                  }

                  status={
                    activeCase.recommendedAction ===
                    'SOURCE_EMERGENCY_REPLACEMENT_STOCK'

                      ? 'STOCK GAP'

                      : 'STOCK ANALYZED'
                  }

                />


                <Agent

                  name="Compliance Agent"

                  icon={
                    <ShieldCheck
                      size={19}
                    />
                  }

                  status={
                    activeCase.qualityStatus ===
                    'PENDING'

                      ? 'QUALITY REVIEW'

                      : 'REVIEWED'
                  }

                />

              </div>

            </div>


            {/* ==================================================
                HUMAN APPROVAL
            =================================================== */}

            <div className="approval-section">

              <div
                className="approval-heading"
              >

                <h3>

                  <UserCheck
                    size={18}
                  />

                  Human Approval

                </h3>


                <p>

                  AI recommendations cannot
                  execute recovery without
                  Operations and Quality
                  approval.

                </p>

              </div>


              <div
                className="approval-grid"
              >

                <ApprovalCard

                  title="Operations Review"

                  status={
                    activeCase.operationsStatus
                  }

                  onApprove={
                    approveOperations
                  }

                />


                <ApprovalCard

                  title="Quality Review"

                  status={
                    activeCase.qualityStatus
                  }

                  onApprove={
                    approveQuality
                  }

                />

              </div>


              {activeCase.operationsStatus ===
                'APPROVED' &&

                activeCase.qualityStatus ===
                'APPROVED' &&

                activeCase.status !==
                'READY_FOR_EXECUTION' && (

                  <button

                    className="finalize-button"

                    onClick={
                      finalizeRecovery
                    }

                  >

                    <CheckCircle
                      size={18}
                    />

                    Authorize Recovery

                  </button>

                )}

            </div>


            {/* ==================================================
                MESSAGE
            =================================================== */}

            {message && (

              <div className="toast">

                <CheckCircle
                  size={17}
                />

                {message}

              </div>

            )}

          </section>

        )}

      </div>

    </main>

  );
}


/* ============================================================
   END USER VIEW
============================================================ */

function EndUserView({
  setMessage,
  loadCases,
  setActiveView
}) {

  const [products, setProducts] =
    useState([]);

  const [companies, setCompanies] =
    useState([]);


  const [form, setForm] =
    useState({

      companyID: '',

      productID: '',

      source: '',

      destination: '',

      quantity: '',

      requiredBy: ''

    });


  const [resources, setResources] =
    useState(null);


  const [analyzing, setAnalyzing] =
    useState(false);


  const [creating, setCreating] =
    useState(false);


  /*
   * ==========================================================
   * LOAD MASTER DATA
   * ==========================================================
   */

  useEffect(() => {

    async function loadMasterData() {

      try {

        const [
          productsResponse,
          companiesResponse
        ] = await Promise.all([

          fetch(
            `${API}/Products`
          ),

          fetch(
            `${API}/PharmaCompanies`
          )

        ]);


        const productsData =
          await productsResponse.json();

        const companiesData =
          await companiesResponse.json();


        setProducts(
          productsData.value || []
        );


        setCompanies(
          companiesData.value || []
        );


      } catch (error) {

        console.error(error);

        setMessage(
          'Unable to load pharma master data.'
        );

      }

    }


    loadMasterData();

  }, []);


  /*
   * ==========================================================
   * FORM FIELD UPDATE
   * ==========================================================
   */

  function updateField(
    field,
    value
  ) {

    setForm(prev => ({

      ...prev,

      [field]: value

    }));


    /*
     * Selecting a company automatically
     * sets the source location.
     */

    if (
      field ===
      'companyID'
    ) {

      const company =
        companies.find(
          item =>
            item.ID === value
        );


      if (company) {

        setForm(prev => ({

          ...prev,

          companyID:
            value,

          source:
            company.location

        }));

      }

    }

  }


  /*
   * ==========================================================
   * RESOURCE AVAILABILITY ANALYSIS
   * ==========================================================
   */

  async function analyzeAvailability() {

    if (
      !form.productID ||
      !form.source ||
      !form.destination ||
      !form.quantity
    ) {

      setMessage(
        'Please enter product, source, destination and quantity.'
      );

      return;

    }


    try {

      setAnalyzing(true);

      setResources(null);


      const quantity =
        Number(form.quantity);


      if (
        !Number.isFinite(
          quantity
        ) ||
        quantity <= 0
      ) {

        throw new Error(
          'Quantity must be greater than zero.'
        );

      }


      const [

        stockResponse,

        transportResponse,

        storageResponse

      ] = await Promise.all([

        fetch(
          `${API}/StockItems`
        ),

        fetch(
          `${API}/TransportResources`
        ),

        fetch(
          `${API}/ColdStorageFacilities`
        )

      ]);


      const stockData =
        await stockResponse.json();

      const transportData =
        await transportResponse.json();

      const storageData =
        await storageResponse.json();


      const selectedProduct =
        products.find(
          item =>
            item.ID ===
            form.productID
        );


      if (!selectedProduct) {

        throw new Error(
          'Selected product could not be found.'
        );

      }


      const requiredTemp =
        selectedProduct.requiredTemperature ||
        '2-8C';


      /*
       * ------------------------------------------------------
       * INVENTORY
       * ------------------------------------------------------
       */

      const stock =
        (stockData.value || [])
          .filter(item =>

            item.product_ID ===
              form.productID &&

            item.status ===
              'AVAILABLE' &&

            Number(
              item.availableQty
            ) >= quantity

          );


      /*
       * ------------------------------------------------------
       * TRANSPORT
       * ------------------------------------------------------
       */

      const transport =
        (transportData.value || [])
          .filter(item =>

            item.status ===
              'AVAILABLE' &&

            Number(
              item.capacity
            ) >= quantity &&

            item.temperatureRange ===
              requiredTemp

          );


      /*
       * ------------------------------------------------------
       * COLD STORAGE
       * ------------------------------------------------------
       */

      const coldStorage =
        (storageData.value || [])
          .filter(item =>

            item.status ===
              'OPERATIONAL' &&

            Number(
              item.availableSpace
            ) >= quantity &&

            item.temperatureRange ===
              requiredTemp

          );


      let availability =
        'NOT_FEASIBLE';


      if (
        stock.length > 0 &&
        transport.length > 0
      ) {

        availability =
          'DELIVERY_OPTIONS_AVAILABLE';

      }


      setResources({

        product:
          selectedProduct,

        requiredTemp,

        stock,

        transport,

        coldStorage,

        quantity,

        availability

      });


    } catch (error) {

      console.error(error);

      setMessage(
        error.message ||
        'Resource analysis failed.'
      );

    } finally {

      setAnalyzing(false);

    }

  }


  /*
   * ==========================================================
   * CREATE + PROCESS RECOVERY REQUEST
   *
   * This is the important new workflow:
   *
   * End User
   *    ↓
   * RecoveryRequests
   *    ↓
   * processRecoveryRequest
   *    ↓
   * Four Agents
   *    ↓
   * Recovery Orchestrator
   *    ↓
   * Human Approval
   *
   * ==========================================================
   */

  async function createRecoveryRequest() {

    if (!resources) {

      setMessage(
        'Please check availability before sending the request.'
      );

      return;

    }


    try {

      setCreating(true);


      const selectedProduct =
        resources.product;


      if (!selectedProduct) {

        throw new Error(
          'Selected product is unavailable.'
        );

      }


      const quantity =
        Number(form.quantity);


      /*
       * ------------------------------------------------------
       * Generate unique IDs
       * ------------------------------------------------------
       */

      const timestamp =
        Date.now();


      const caseID =
        `REQ${timestamp
          .toString()
          .slice(-7)}`;


      const shipmentID =
        `USR${timestamp
          .toString()
          .slice(-6)}`;


      /*
       * ------------------------------------------------------
       * IMPORTANT:
       *
       * Initial risk/recommendation are only placeholders.
       *
       * The backend Recovery Orchestrator becomes the
       * authoritative decision-maker.
       * ------------------------------------------------------
       */

      const payload = {

        ID:
          caseID,

        shipment_ID:
          shipmentID,

        product_ID:
          selectedProduct.ID,

        source:
          form.source,

        destination:
          form.destination,

        requestedQty:
          quantity,

        riskLevel:
          'LOW',

        recommendedAction:
          'PENDING_AGENT_ANALYSIS',

        alternativeAction:
          'PENDING_AGENT_ANALYSIS',

        reason:
          `End-user delivery request for ${selectedProduct.name}. ` +
          `Required temperature ${resources.requiredTemp}. ` +
          `PharmaResQ agents will evaluate inventory, logistics and compliance.`,

        status:
          'PENDING_AGENT_ANALYSIS',

        operationsStatus:
          'PENDING',

        qualityStatus:
          'PENDING',

        operationsDecision:
          null,

        qualityDecision:
          null

      };


      /*
       * ------------------------------------------------------
       * STEP 1
       *
       * Create RecoveryRequest
       * ------------------------------------------------------
       */

      const response =
        await fetch(
          `${API}/RecoveryRequests`,
          {

            method:
              'POST',

            headers: {

              'Content-Type':
                'application/json'

            },

            body:
              JSON.stringify(
                payload
              )

          }
        );


      if (!response.ok) {

        const errorText =
          await response.text();

        throw new Error(
          `Unable to create recovery request: ${errorText}`
        );

      }


      /*
       * ------------------------------------------------------
       * STEP 2
       *
       * Run the four-agent orchestrator.
       * ------------------------------------------------------
       */

      setMessage(
        `Request ${caseID} created. Running PharmaResQ agents...`
      );


      const processResponse =
        await fetch(
          `${API}/processRecoveryRequest`,
          {

            method:
              'POST',

            headers: {

              'Content-Type':
                'application/json'

            },

            body:
              JSON.stringify({

                caseID:
                  caseID

              })

          }
        );


      if (!processResponse.ok) {

        const errorText =
          await processResponse.text();

        throw new Error(
          `Agent processing failed: ${errorText}`
        );

      }


      /*
       * ------------------------------------------------------
       * STEP 3
       *
       * Parse CAP action response.
       *
       * CAP exposes LargeString action results through:
       *
       * {
       *   value: "..."
       * }
       * ------------------------------------------------------
       */

      const processData =
        await processResponse.json();


      let agentResult =
        null;


      if (
        processData.value
      ) {

        try {

          agentResult =
            typeof processData.value ===
              'string'

              ? JSON.parse(
                  processData.value
                )

              : processData.value;

        } catch (parseError) {

          console.warn(
            'Unable to parse agent response:',
            parseError
          );

        }

      }


      /*
       * ------------------------------------------------------
       * STEP 4
       *
       * Store the processed result locally.
       * ------------------------------------------------------
       */

      setResources(prev => ({

        ...prev,

        createdCaseID:
          caseID,

        agentResult:
          agentResult

      }));


      /*
       * ------------------------------------------------------
       * STEP 5
       *
       * Tell the user what the orchestrator decided.
       * ------------------------------------------------------
       */

      const recommendation =
        agentResult?.decision
          ?.recommendedAction;


      if (recommendation) {

        setMessage(

          `Request ${caseID} processed successfully. ` +
          `Recommendation: ${formatAction(
            recommendation
          )}. ` +
          `Operations and Quality approval is required.`

        );

      } else {

        setMessage(

          `Request ${caseID} created and sent to Pharma Operations.`

        );

      }


      /*
       * ------------------------------------------------------
       * STEP 6
       *
       * Refresh Operations Control.
       * ------------------------------------------------------
       */

      if (loadCases) {

        await loadCases();

      }


    } catch (error) {

      console.error(
        'Recovery request error:',
        error
      );


      setMessage(

        error.message ||
        'Unable to process recovery request.'

      );

    } finally {

      setCreating(false);

    }

  }


  const selectedProduct =
    products.find(
      item =>
        item.ID ===
        form.productID
    );


  /*
   * ==========================================================
   * END USER UI
   * ==========================================================
   */

  return (

    <main
      className="main end-user-page"
    >


      {/* ======================================================
          PAGE HEADING
      ======================================================= */}

      <div className="page-heading">

        <div>

          <h2>
            Pharma Delivery Request
          </h2>

          <p>

            Check pharmaceutical
            availability and cold-chain
            resources for your destination.

          </p>

        </div>


        <div
          className="end-user-badge"
        >

          <Navigation size={15} />

          CUSTOMER REQUEST

        </div>

      </div>


      {/* ======================================================
          REQUEST FORM
      ======================================================= */}

      <section
        className="request-card"
      >

        <div
          className="request-header"
        >

          <div
            className="request-icon"
          >

            <Package
              size={23}
            />

          </div>


          <div>

            <h3>
              Create Delivery Request
            </h3>

            <p>

              Enter your requirement.
              PharmaResQ will check stock,
              refrigerated transport and
              qualified cold-storage
              resources.

            </p>

          </div>

        </div>


        <div className="form-grid">


          {/* ==================================================
              COMPANY
          =================================================== */}

          <div className="form-field">

            <label>
              Pharma Company
            </label>


            <div
              className="input-wrapper"
            >

              <Building2
                size={16}
              />


              <select

                value={
                  form.companyID
                }

                onChange={e =>
                  updateField(
                    'companyID',
                    e.target.value
                  )
                }

              >

                <option value="">
                  Select company
                </option>


                {companies.map(
                  company => (

                    <option

                      key={
                        company.ID
                      }

                      value={
                        company.ID
                      }

                    >

                      {company.name}

                    </option>

                  )
                )}

              </select>

            </div>

          </div>


          {/* ==================================================
              PRODUCT
          =================================================== */}

          <div className="form-field">

            <label>
              Pharmaceutical Product
            </label>


            <div
              className="input-wrapper"
            >

              <Package
                size={16}
              />


              <select

                value={
                  form.productID
                }

                onChange={e =>
                  updateField(
                    'productID',
                    e.target.value
                  )
                }

              >

                <option value="">
                  Select product
                </option>


                {products.map(
                  item => (

                    <option

                      key={
                        item.ID
                      }

                      value={
                        item.ID
                      }

                    >

                      {item.name}

                    </option>

                  )
                )}

              </select>

            </div>

          </div>


          {/* ==================================================
              SOURCE
          =================================================== */}

          <div className="form-field">

            <label>
              Source Location
            </label>


            <div
              className="input-wrapper"
            >

              <MapPin
                size={16}
              />


              <input

                value={
                  form.source
                }

                onChange={e =>
                  updateField(
                    'source',
                    e.target.value
                  )
                }

                placeholder="e.g. Hyderabad"

              />

            </div>

          </div>


          {/* ==================================================
              DESTINATION
          =================================================== */}

          <div className="form-field">

            <label>
              Destination
            </label>


            <div
              className="input-wrapper"
            >

              <Navigation
                size={16}
              />


              <input

                value={
                  form.destination
                }

                onChange={e =>
                  updateField(
                    'destination',
                    e.target.value
                  )
                }

                placeholder="e.g. Vijayawada"

              />

            </div>

          </div>


          {/* ==================================================
              QUANTITY
          =================================================== */}

          <div className="form-field">

            <label>
              Quantity
            </label>


            <div
              className="input-wrapper"
            >

              <Package
                size={16}
              />


              <input

                type="number"

                min="1"

                value={
                  form.quantity
                }

                onChange={e =>
                  updateField(
                    'quantity',
                    e.target.value
                  )
                }

                placeholder="Required quantity"

              />

            </div>

          </div>


          {/* ==================================================
              REQUIRED DELIVERY
          =================================================== */}

          <div className="form-field">

            <label>
              Required Delivery
            </label>


            <div
              className="input-wrapper"
            >

              <Clock
                size={16}
              />


              <input

                type="datetime-local"

                value={
                  form.requiredBy
                }

                onChange={e =>
                  updateField(
                    'requiredBy',
                    e.target.value
                  )
                }

              />

            </div>

          </div>

        </div>


        {/* ====================================================
            PRODUCT REQUIREMENT
        ===================================================== */}

        {selectedProduct && (

          <div
            className="product-requirement"
          >

            <Thermometer
              size={17}
            />

            <span>
              Cold-chain requirement:
            </span>


            <strong>
              {
                selectedProduct
                  .requiredTemperature
              }
            </strong>


            <span>
              {
                selectedProduct
                  .description
              }
            </span>

          </div>

        )}


        {/* ====================================================
            CHECK AVAILABILITY
        ===================================================== */}

        <button

          className="analyze-button"

          onClick={
            analyzeAvailability
          }

          disabled={
            analyzing
          }

        >

          {analyzing ? (

            <>

              <RefreshCw
                size={17}
                className="spin"
              />

              Checking resources...

            </>

          ) : (

            <>

              <Search
                size={17}
              />

              Check Availability

            </>

          )}

        </button>

      </section>


      {/* ======================================================
          AVAILABILITY RESULTS
      ======================================================= */}

      {resources && (

        <section
          className="availability-section"
        >


          <div
            className="availability-header"
          >

            <div>

              <h3>
                Resource Availability
              </h3>


              <p>

                Dynamic resource check for{' '}

                <strong>
                  {form.source}
                </strong>


                {' → '}


                <strong>
                  {form.destination}
                </strong>

              </p>

            </div>


            <span

              className={

                resources.availability ===
                'DELIVERY_OPTIONS_AVAILABLE'

                  ? 'available-badge'

                  : 'unavailable-badge'

              }

            >

              {
                resources.availability ===
                'DELIVERY_OPTIONS_AVAILABLE'

                  ? 'DELIVERY FEASIBLE'

                  : 'RESOURCE GAP'
              }

            </span>

          </div>


          {/* ==================================================
              RESOURCE GRID
          =================================================== */}

          <div className="resource-grid">


            {/* =================================================
                INVENTORY
            ================================================== */}

            <ResourceCard

              icon={
                <Package
                  size={21}
                />
              }

              title="Inventory"

              count={
                resources.stock.length
              }

              label="Eligible stock sources"

              positive={
                resources.stock.length > 0
              }

            >

              {resources.stock
                .slice(0, 3)
                .map(item => (

                  <ResourceRow

                    key={
                      item.ID
                    }

                    title={
                      item.batchNumber
                    }

                    subtitle={
                      `${item.sourceLocation} · ${item.availableQty} available`
                    }

                  />

                ))}


              {resources.stock.length ===
                0 && (

                <EmptyResource
                  text="No sufficient stock found."
                />

              )}

            </ResourceCard>


            {/* =================================================
                TRANSPORT
            ================================================== */}

            <ResourceCard

              icon={
                <Truck
                  size={21}
                />
              }

              title="Refrigerated Transport"

              count={
                resources.transport.length
              }

              label="Qualified vehicles"

              positive={
                resources.transport.length > 0
              }

            >

              {resources.transport
                .slice(0, 3)
                .map(item => (

                  <ResourceRow

                    key={
                      item.ID
                    }

                    title={
                      item.vehicleNumber
                    }

                    subtitle={
                      `${item.provider} · ${item.capacity} units`
                    }

                  />

                ))}


              {resources.transport.length ===
                0 && (

                <EmptyResource

                  text={
                    'No suitable refrigerated vehicle.'
                  }

                />

              )}

            </ResourceCard>


            {/* =================================================
                COLD STORAGE
            ================================================== */}

            <ResourceCard

              icon={
                <Warehouse
                  size={21}
                />
              }

              title="Cold Storage"

              count={
                resources.coldStorage.length
              }

              label="Qualified facilities"

              positive={
                resources.coldStorage.length > 0
              }

            >

              {resources.coldStorage
                .slice(0, 3)
                .map(item => (

                  <ResourceRow

                    key={
                      item.ID
                    }

                    title={
                      item.name
                    }

                    subtitle={
                      `${item.location} · ${item.availableSpace} units free`
                    }

                  />

                ))}


              {resources.coldStorage.length ===
                0 && (

                <EmptyResource

                  text={
                    'No qualified cold storage found.'
                  }

                />

              )}

            </ResourceCard>

          </div>


          {/* ==================================================
              DELIVERY PLAN
          =================================================== */}

          <div
            className="delivery-plan"
          >

            <div
              className="delivery-plan-icon"
            >

              <Route
                size={22}
              />

            </div>


            <div
              className="delivery-plan-content"
            >

              <span>
                PHARMARESQ RESOURCE DECISION
              </span>


              <h3>

                {
                  resources.availability ===
                  'DELIVERY_OPTIONS_AVAILABLE'

                    ? 'Cold-chain delivery resources are available'

                    : 'Additional resources are required'
                }

              </h3>


              <p>

                {
                  resources.availability ===
                  'DELIVERY_OPTIONS_AVAILABLE'

                    ? `Inventory, temperature-compatible transport and cold-chain infrastructure were checked for ${form.quantity} units of ${resources.product?.name}.`

                    : `The requested quantity cannot currently be fulfilled with the available cold-chain resources.`
                }

              </p>

            </div>

          </div>


          {/* ==================================================
              AGENT PROCESSING RESULT
          =================================================== */}

          {resources.agentResult && (

            <div
              className="delivery-plan"
            >

              <div
                className="delivery-plan-icon"
              >

                <ShieldCheck
                  size={22}
                />

              </div>


              <div
                className="delivery-plan-content"
              >

                <span>
                  PHARMARESQ AGENT ORCHESTRATION
                </span>


                <h3>

                  {
                    formatAction(
                      resources.agentResult
                        ?.decision
                        ?.recommendedAction
                    )
                  }

                </h3>


                <p>

                  Four agents evaluated
                  inventory, logistics,
                  compliance and the
                  planned-delivery scenario.

                  Human Operations and
                  Quality approval is still
                  required before execution.

                </p>

              </div>

            </div>

          )}


          {/* ==================================================
              CREATE CASE
          =================================================== */}

          {resources.createdCaseID ? (

            <div
              className="created-case"
            >

              <CheckCircle
                size={21}
              />


              <div>

                <strong>
                  Recovery request processed
                </strong>


                <span>

                  Case ID:
                  {' '}
                  {resources.createdCaseID}

                </span>

              </div>


              <ClipboardCheck
                size={20}
              />

            </div>

          ) : (

            <button

              className="create-case-button"

              onClick={
                createRecoveryRequest
              }

              disabled={
                creating
              }

            >

              {creating ? (

                <>

                  <RefreshCw
                    size={17}
                    className="spin"
                  />

                  Running PharmaResQ
                  agents...

                </>

              ) : (

                <>

                  <ClipboardCheck
                    size={17}
                  />

                  Send Request to
                  Pharma Operations

                  <ArrowRight
                    size={17}
                  />

                </>

              )}

            </button>

          )}

        </section>

      )}

    </main>

  );
}


/* ============================================================
   SMALL COMPONENTS
============================================================ */

function Kpi({
  icon,
  label,
  value,
  type
}) {

  return (

    <div
      className="kpi-card"
    >

      <div
        className={
          `kpi-icon ${type}`
        }
      >

        {icon}

      </div>


      <div>

        <span>
          {label}
        </span>


        <strong>
          {value}
        </strong>

      </div>

    </div>

  );

}


function Info({
  label,
  value,
  icon
}) {

  return (

    <div>

      <label>
        {label}
      </label>


      <strong>

        {icon}

        {value}

      </strong>

    </div>

  );

}


function TelemetryCard({
  label,
  value,
  status,
  critical = false,
  icon
}) {

  return (

    <div

      className={
        `telemetry-card ${
          critical
            ? 'critical'
            : ''
        }`
      }

    >

      <div
        className="telemetry-top"
      >

        <span
          className="telemetry-icon"
        >

          {icon}

        </span>


        <span
          className="telemetry-label"
        >

          {label}

        </span>

      </div>


      <strong>
        {value}
      </strong>


      <small>

        <i></i>

        {status}

      </small>

    </div>

  );

}


function Agent({
  name,
  icon,
  status
}) {

  return (

    <div
      className="agent-card"
    >

      <div
        className="agent-icon"
      >

        {icon}

      </div>


      <div>

        <strong>
          {name}
        </strong>


        <span>

          <i></i>

          {status}

        </span>

      </div>

    </div>

  );

}


function ApprovalCard({
  title,
  status,
  onApprove
}) {

  const approved =
    status ===
    'APPROVED';


  const rejected =
    status ===
    'REJECTED';


  return (

    <div
      className="approval-card"
    >

      <div>

        <strong>
          {title}
        </strong>


        <span

          className={

            approved
              ? 'approval-approved'

              : rejected
                ? 'approval-rejected'

                : 'approval-pending'

          }

        >

          {approved

            ? '✓ APPROVED'

            : rejected

              ? '✕ REJECTED'

              : '● PENDING'

          }

        </span>

      </div>


      {!approved &&
        !rejected && (

        <button

          onClick={
            onApprove
          }

          className="approve-button"

        >

          Approve

        </button>

      )}

    </div>

  );

}


function ResourceCard({
  icon,
  title,
  count,
  label,
  positive,
  children
}) {

  return (

    <div
      className="resource-card"
    >

      <div
        className="resource-card-header"
      >

        <div
          className="resource-card-icon"
        >

          {icon}

        </div>


        <div>

          <strong>
            {title}
          </strong>


          <span>
            {label}
          </span>

        </div>


        <b

          className={

            positive

              ? 'resource-count-positive'

              : 'resource-count-negative'

          }

        >

          {count}

        </b>

      </div>


      <div
        className="resource-items"
      >

        {children}

      </div>

    </div>

  );

}


function ResourceRow({
  title,
  subtitle
}) {

  return (

    <div
      className="resource-row"
    >

      <CheckCircle
        size={14}
      />


      <div>

        <strong>
          {title}
        </strong>


        <span>
          {subtitle}
        </span>

      </div>

    </div>

  );

}


function EmptyResource({
  text
}) {

  return (

    <div
      className="empty-resource"
    >

      <AlertTriangle
        size={15}
      />

      {text}

    </div>

  );

}


function formatAction(
  value
) {

  if (!value) {
    return '—';
  }


  return value

    .replaceAll(
      '_',
      ' '
    )

    .toLowerCase()

    .replace(
      /\b\w/g,
      char =>
        char.toUpperCase()
    );

}


export default App;