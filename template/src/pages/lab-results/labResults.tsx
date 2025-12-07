import { Link } from "react-router-dom";
import CommonFooter from "../../components/common-footer/commonFooter";
import { all_routes } from "../../routes/all_routes";

const LabResults = () => {
  return (
    <>
      <div className="page-wrapper">
        <div className="content">
          {/* Page Header */}
          <div className="d-flex align-items-center justify-content-between gap-2 mb-4 flex-wrap">
            <div className="breadcrumb-arrow">
              <h4 className="mb-1">Lab Results</h4>
              <div className="text-end">
                <ol className="breadcrumb m-0 py-0">
                  <li className="breadcrumb-item">
                    <Link to={all_routes.dashboard}>Home</Link>
                  </li>
                  <li className="breadcrumb-item active">Lab Results</li>
                </ol>
              </div>
            </div>
          </div>
          {/* End Page Header */}

          <div className="card">
            <div className="card-body">
              <h5>Lab Results</h5>
              <p className="text-muted">Lab results page coming soon...</p>
            </div>
          </div>
        </div>
        <CommonFooter />
      </div>
    </>
  );
};

export default LabResults;