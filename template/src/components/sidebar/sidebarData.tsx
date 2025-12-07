import { all_routes } from "../../routes/all_routes";

const route = all_routes;
export const SidebarData = [
  {
    tittle: "",
    submenuItems: [
      {
        label: "Dashboard",
        link: route.dashboard,
        submenu: false,
        icon: "layout-board",
        submenuItems: [],
      },
      {
        label: "Calendar",
        link: "/calendar-view",
        submenu: false,
        icon: "calendar-event",
        submenuItems: [],
      },
      {
        label: "Patients",
        link: route.patients,
        relatedRoutes: [
          route.addPatient,
          route.editPatient,
          route.allPatientsList,
          route.patientDetails,
          route.patientDetailsAppointment,
          route.patientDetailsVitalSign,
          route.patientDetailsVisitHistory,
          route.patientDetailsLabResults,
          route.patientdetailsPrescription,
          route.patientetailsMedicalHistory,
          route.patientetailsDocuments,
        ], 
        submenu: false,
        icon: "users",
        submenuItems: [],
      },
      {
        label: "Appointments",
        link: route.appointments,
        relatedRoutes: [
          route.appointmentConsultation,
        ], 
        submenu: false,
        icon: "calendar-time",
        submenuItems: [],
      },
      {
        label: "Settings",
        link: "#theme-settings",
        submenu: false,
        icon: "settings",
        submenuItems: [],
        isThemeSettings: true,
      },
    ],
  },
  // Admin Section - Staff, Insurance, Billing, Audit Trail
  {
    tittle: "Admin",
    submenuItems: [
      {
        label: "Staff",
        link: route.doctors,
        relatedRoutes: [
          route.allDoctorsList,
          route.doctorDetails,
          route.addDoctors,
          route.editDoctors,
        ], 
        submenu: false,
        icon: "users-group",
        submenuItems: [],
      },
      {
        label: "Insurance",
        link: "/insurance",
        submenu: false,
        icon: "shield-check",
        submenuItems: [],
      },
      {
        label: "Billing",
        link: "/billing",
        submenu: false,
        icon: "report-money",
        submenuItems: [],
      },
      {
        label: "Audit Trail",
        link: "/audit-logs",
        submenu: false,
        icon: "file-analytics",
        submenuItems: [],
      },
    ],
  },
];