import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import { all_routes } from "../../routes/all_routes";

const tabs = [
  { label: "Patient Profile", route: all_routes.patientDetails },
  { label: "Appointments", route: all_routes.patientDetailsAppointment },
  { label: "Vital Signs", route: all_routes.patientDetailsVitalSign },
  { label: "Visit History", route: all_routes.patientetailsVisitHistory },
  { label: "Lab Results", route: all_routes.patientetailsLabResults },
  { label: "Prescription", route: all_routes.patientdetailsPrescription },
  { label: "Medical History", route: all_routes.patientetailsMedicalHistory },
  { label: "Documents", route: all_routes.patientetailsDocuments },
];

const PatientDetailsHeader = () => {
  const location = useLocation();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const patientId = id || searchParams.get('id');

  return (
    <ul className="nav nav-tabs nav-solid-primary border-bottom pb-4 mb-4 d-flex align-items-center gap-2">
      {tabs.map((tab) => (
        <li className="nav-item" key={tab.route}>
          <Link
            to={`${tab.route}${patientId ? `?id=${patientId}` : ''}`}
            className={`nav-link border rounded fw-semibold${location.pathname === tab.route ? " active" : ""}`}
          >
            {tab.label}
          </Link>
        </li>
      ))}
    </ul>
  );
};

export default PatientDetailsHeader;