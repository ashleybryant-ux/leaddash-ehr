import { Link } from "react-router-dom";
import CommonFooter from "../../components/common-footer/commonFooter";
import { all_routes } from "../../routes/all_routes";
import { OverlayScrollbarsComponent } from "overlayscrollbars-react";
import { useState, useEffect } from "react";
import axios from 'axios';
import config from '../../config';

const API_URL = config.apiUrl;
const LOCATION_ID = config.ghlLocationId;

// SVG-based CircleProgress component
const CircleProgress = ({
  value = 0,
  color = "#ffb300",
  size = 25,
  stroke = 5,
}) => {
  const val = Math.max(0, Math.min(100, value));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - val / 100);

  return (
    <svg width={size} height={size} style={{ display: "block" }}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="#f5f5f5"
        strokeWidth={stroke}
        fill="none"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={color}
        strokeWidth={stroke}
        fill="none"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.5s" } as React.CSSProperties}
      />
    </svg>
  );
};

const Todo = () => {
  // ============================================
  // STATE MANAGEMENT
  // ============================================
  
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState('newest');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  
  // Form state for new task
  const [newTask, setNewTask] = useState({
    title: '',
    status: 'pending',
    priority: 'medium',
    createdDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    description: '',
    assignee: ''
  });

  // ============================================
  // FETCH TASKS FROM LEADDASH
  // ============================================
  
  useEffect(() => {
    fetchTasks();
  }, [sortOrder]);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      console.log('📋 Fetching tasks from LeadDash...');
      
      const response = await axios.get(`${API_URL}/api/tasks`, {
        params: {
          locationId: LOCATION_ID,
          limit: 100
        }
      });

      if (response.data.success) {
        let tasksData = response.data.tasks;
        
        // Sort tasks
        if (sortOrder === 'newest') {
          tasksData = tasksData.sort((a: any, b: any) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        } else {
          tasksData = tasksData.sort((a: any, b: any) => 
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
        }
        
        setTasks(tasksData);
        console.log(`✅ Loaded ${tasksData.length} tasks`);
      }
    } catch (error) {
      console.error('❌ Error fetching tasks:', error);
      alert('Failed to load tasks from LeadDash');
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // ADD TASK TO LEADDASH
  // ============================================
  
  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newTask.title) {
      alert('Please enter a task title');
      return;
    }

    setSaving(true);
    try {
      console.log('💾 Creating task in LeadDash...');

      const response = await axios.post(
        `${API_URL}/api/tasks`,
        {
          title: newTask.title,
          body: newTask.description || '',
          dueDate: newTask.dueDate || new Date().toISOString(),
          assignedTo: newTask.assignee || 'unassigned',
          status: newTask.status,
          priority: newTask.priority
        },
        {
          params: { locationId: LOCATION_ID }
        }
      );

      if (response.data.success) {
        console.log('✅ Task created');
        
        // Refresh tasks
        await fetchTasks();
        
        // Reset form
        setNewTask({
          title: '',
          status: 'pending',
          priority: 'medium',
          createdDate: new Date().toISOString().split('T')[0],
          dueDate: '',
          description: '',
          assignee: ''
        });
        
        // Close modal
        const modal = document.getElementById('add_todo');
        if (modal) {
          // @ts-ignore
          const bsModal = window.bootstrap.Modal.getInstance(modal);
          if (bsModal) bsModal.hide();
        }
        
        alert('Task added successfully!');
      }
    } catch (error) {
      console.error('❌ Error creating task:', error);
      alert('Failed to create task in LeadDash');
    } finally {
      setSaving(false);
    }
  };

  // ============================================
  // DELETE TASK
  // ============================================
  
  const handleDeleteTask = async () => {
    if (!taskToDelete) return;

    setDeleteLoading(true);
    try {
      console.log('🗑️ Deleting task:', taskToDelete);
      
      await axios.delete(`${API_URL}/api/tasks/${taskToDelete}`, {
        params: { locationId: LOCATION_ID }
      });

      console.log('✅ Task deleted');
      
      setTasks(prev => prev.filter(t => t.id !== taskToDelete));
      
      const modal = document.getElementById('delete_modal');
      if (modal) {
        // @ts-ignore
        const bsModal = window.bootstrap.Modal.getInstance(modal);
        if (bsModal) bsModal.hide();
      }
      
      alert('Task deleted successfully');
    } catch (error) {
      console.error('❌ Error deleting task:', error);
      alert('Failed to delete task');
    } finally {
      setDeleteLoading(false);
      setTaskToDelete(null);
    }
  };

  // ============================================
  // HELPER FUNCTIONS
  // ============================================
  
  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric'
    });
  };

  const getStatusBadge = (status: string) => {
    const statusMap: any = {
      'completed': { class: 'bg-success', label: 'Completed' },
      'pending': { class: 'bg-purple', label: 'Pending' },
      'inprogress': { class: 'bg-info', label: 'In Progress' },
      'on-hold': { class: 'bg-pink', label: 'On Hold' }
    };
    return statusMap[status?.toLowerCase()] || { class: 'bg-secondary', label: 'Unknown' };
  };

  const calculateProgress = (task: any) => {
    if (task.status === 'completed') return 100;
    if (task.status === 'inprogress') return 60;
    if (task.status === 'pending') return 30;
    return 0;
  };

  return (
    <>
      {/* ========================
              Start Page Content
          ========================= */}
      <div className="page-wrapper">
        {/* Start Content */}
        <div className="content">
          {/* Page Header */}
          <div className="d-flex align-items-center justify-content-between gap-2 mb-4 flex-wrap">
            <div className="breadcrumb-arrow">
              <h4 className="mb-1">To Do</h4>
              <div className="text-end">
                <ol className="breadcrumb m-0 py-0">
                  <li className="breadcrumb-item">
                    <Link to={all_routes.dashboard}>Home</Link>
                  </li>
                  <li className="breadcrumb-item">
                    <Link to="#">Applications</Link>
                  </li>
                  <li className="breadcrumb-item active">To Do</li>
                </ol>
              </div>
            </div>
            <div className="gap-2 d-flex align-items-center flex-wrap">
              <button
                onClick={fetchTasks}
                className="btn btn-icon btn-white"
                data-bs-toggle="tooltip"
                data-bs-placement="top"
                aria-label="Refresh"
                data-bs-original-title="Refresh"
                disabled={loading}
              >
                <i className={`ti ti-refresh ${loading ? 'spin' : ''}`} />
              </button>
              <Link
                to="#"
                className="btn btn-icon btn-white"
                data-bs-toggle="tooltip"
                data-bs-placement="top"
                aria-label="Print"
                data-bs-original-title="Print"
              >
                <i className="ti ti-printer" />
              </Link>
            </div>
          </div>
          {/* End Page Header */}

          {/* LEADDASH STATUS */}
          <div className="alert alert-info mb-3">
            <i className="ti ti-plug-connected me-2" />
            Connected to LeadDash - Tasks sync with your account
          </div>

          <div className="card shadow-none mb-0">
            <div className="card-body p-0">
              <div className="row g-0">
                <div className="col-lg-3 col-md-4">
                  <OverlayScrollbarsComponent style={{ overflow: "auto"}}
                    className=" p-4 pb-0 pb-sm-4 mail-sidebar border-end h-100"
                    data-simplebar=""
                  >
                    <div>
                      <div className="mb-3">
                        <Link
                          to="#"
                          className="btn btn-primary btn-lg w-100"
                          data-bs-toggle="modal"
                          data-bs-target="#add_todo"
                        >
                          <i className="ti ti-square-rounded-plus me-1" />
                          Add Task
                        </Link>
                      </div>
                      <div className="border-bottom pb-3 mb-3">
                        <div className="nav flex-column nav-pills">
                          <Link
                            to="#"
                            className="d-flex text-start align-items-center fw-medium fs-14 bg-light rounded p-2 mb-1"
                          >
                            <i className="ti ti-inbox me-2" />
                            All Tasks{" "}
                            <span className="avatar avatar-xs ms-auto bg-danger rounded-circle">
                              {tasks.length}
                            </span>
                          </Link>
                          <Link
                            to="#"
                            className="d-flex text-start align-items-center fw-medium fs-14 rounded p-2 mb-1"
                          >
                            <i className="ti ti-star me-2" />
                            Starred
                          </Link>
                          <Link
                            to="#"
                            className="d-flex text-start align-items-center fw-medium fs-14 rounded p-2 mb-0"
                          >
                            <i className="ti ti-trash me-2" />
                            Trash
                          </Link>
                        </div>
                      </div>
                      <div
                        className="accordion accordion-flush custom-accordion"
                        id="accordionFlushExample"
                      >
                        <div className="accordion-item mb-3 pb-3">
                          <h2 className="accordion-header mb-0">
                            <button
                              className="accordion-button fw-semibold p-0 bg-transparent"
                              type="button"
                              data-bs-toggle="collapse"
                              data-bs-target="#flush-collapseOne"
                              aria-expanded="true"
                              aria-controls="flush-collapseOne"
                            >
                              Priority
                            </button>
                          </h2>
                          <div
                            id="flush-collapseOne"
                            className="accordion-collapse collapse show"
                          >
                            <div className="d-flex flex-column mt-3">
                              <Link
                                to="#"
                                className="d-flex align-items-center fw-medium mb-2"
                              >
                                <i className="ti ti-point-filled text-success me-1 fs-18" />
                                Low
                              </Link>
                              <Link
                                to="#"
                                className="d-flex align-items-center fw-medium mb-2"
                              >
                                <i className="ti ti-point-filled text-warning me-1 fs-18" />
                                Medium
                              </Link>
                              <Link
                                to="#"
                                className="d-flex align-items-center fw-medium"
                              >
                                <i className="ti ti-point-filled text-danger fs-18 me-1" />
                                High
                              </Link>
                            </div>
                          </div>
                        </div>
                        <div className="accordion-item border-0">
                          <h2 className="accordion-header mb-0">
                            <button
                              className="accordion-button fw-semibold p-0 bg-transparent collapsed"
                              type="button"
                              data-bs-toggle="collapse"
                              data-bs-target="#flush-collapseTwo"
                              aria-expanded="false"
                              aria-controls="flush-collapseTwo"
                            >
                              Categories
                            </button>
                          </h2>
                          <div
                            id="flush-collapseTwo"
                            className="accordion-collapse collapse"
                          >
                            <div className="d-flex flex-column mt-3">
                              <Link
                                to="#"
                                className="d-flex align-items-center fw-medium mb-2"
                              >
                                <i className="ti ti-point-filled text-purple me-1 fs-18" />
                                Social
                              </Link>
                              <Link
                                to="#"
                                className="d-flex align-items-center fw-medium mb-2"
                              >
                                <i className="ti ti-point-filled text-info me-1 fs-18" />
                                Research
                              </Link>
                              <Link
                                to="#"
                                className="d-flex align-items-center fw-medium mb-2"
                              >
                                <i className="ti ti-point-filled text-pink me-1 fs-18" />
                                Web Design
                              </Link>
                              <Link
                                to="#"
                                className="d-flex align-items-center fw-medium"
                              >
                                <i className="ti ti-point-filled text-danger me-1 fs-18" />
                                Reminder
                              </Link>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </OverlayScrollbarsComponent>
                </div>
                <div className="col-lg-9 col-md-8 d-flex">
                  <div className="card m-sm-4 mx-4 w-100">
                    <div className="card-header d-flex align-items-center flex-wrap gap-2 justify-content-between">
                      <h5 className="d-inline-flex align-items-center mb-0">
                        Todo<span className="badge bg-danger ms-2">{tasks.length}</span>
                      </h5>
                      <div className="d-flex align-items-center">
                        <div className="dropdown">
                          <Link
                            to="#"
                            className="dropdown-toggle btn btn-md btn-outline-light d-inline-flex align-items-center"
                            data-bs-toggle="dropdown"
                            aria-label="Sort options menu" 
                            aria-haspopup="true" 
                            aria-expanded="false"
                          >
                            <i className="ti ti-sort-descending-2 me-1" />
                            <span className="me-1">Sort By : </span> {sortOrder === 'newest' ? 'Newest' : 'Oldest'}
                          </Link>
                          <ul className="dropdown-menu dropdown-menu-end p-2">
                            <li>
                              <button 
                                className="dropdown-item rounded-1"
                                onClick={() => setSortOrder('newest')}
                              >
                                Newest
                              </button>
                            </li>
                            <li>
                              <button 
                                className="dropdown-item rounded-1"
                                onClick={() => setSortOrder('oldest')}
                              >
                                Oldest
                              </button>
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>
                    <div className="card-body table-custom p-0">
                      {/* Loading State */}
                      {loading && (
                        <div className="text-center py-5">
                          <div className="spinner-border text-primary" role="status">
                            <span className="visually-hidden">Loading...</span>
                          </div>
                          <p className="mt-2">Loading tasks from LeadDash...</p>
                        </div>
                      )}

                      {/* No Tasks */}
                      {!loading && tasks.length === 0 && (
                        <div className="text-center py-5">
                          <i className="ti ti-checkbox fs-48 text-muted mb-3 d-block" />
                          <h5>No Tasks Found</h5>
                          <p className="text-muted">Start by adding your first task</p>
                          <button
                            className="btn btn-primary mt-2"
                            data-bs-toggle="modal"
                            data-bs-target="#add_todo"
                          >
                            <i className="ti ti-plus me-1" />
                            Add Task
                          </button>
                        </div>
                      )}

                      {/* table start */}
                      {!loading && tasks.length > 0 && (
                        <div className="table-responsive table-nowrap">
                          <table className="table border-0 datatable">
                            <thead className="table-light">
                              <tr>
                                <th>Task Title</th>
                                <th className="no-sort">Created Date</th>
                                <th>Status</th>
                                <th>Due Date</th>
                                <th>Progress</th>
                                <th className="no-sort" />
                              </tr>
                            </thead>
                            <tbody>
                              {tasks.map((task) => {
                                const statusBadge = getStatusBadge(task.status);
                                const progress = calculateProgress(task);
                                
                                return (
                                  <tr key={task.id}>
                                    <td>{task.title}</td>
                                    <td>{formatDate(task.createdAt)}</td>
                                    <td>
                                      <span className={`badge ${statusBadge.class}`}>
                                        {statusBadge.label}
                                      </span>
                                    </td>
                                    <td>{formatDate(task.dueDate)}</td>
                                    <td>
                                      <div className="d-flex align-items-center gap-3">
                                        <CircleProgress
                                          value={progress}
                                          color="#ffb300"
                                          size={25}
                                          stroke={5}
                                        />
                                        <span style={{ fontWeight: 500, color: "#444" }}>
                                          {progress}%
                                        </span>
                                      </div>
                                    </td>
                                    <td className="text-end">
                                      <Link
                                        to="#"
                                        className="btn btn-icon btn-outline-light"
                                        data-bs-toggle="dropdown"
                                        aria-label="Task actions menu" 
                                        aria-haspopup="true" 
                                        aria-expanded="false"
                                      >
                                        <i className="ti ti-dots-vertical" aria-hidden="true" />
                                      </Link>
                                      <ul className="dropdown-menu p-2">
                                        <li>
                                          <Link
                                            to="#"
                                            className="dropdown-item d-flex align-items-center"
                                            data-bs-toggle="modal"
                                            data-bs-target="#edit_todo"
                                          >
                                            <i className="ti ti-edit me-1" />
                                            Edit
                                          </Link>
                                        </li>
                                        <li>
                                          <button
                                            className="dropdown-item d-flex align-items-center text-danger"
                                            data-bs-toggle="modal"
                                            data-bs-target="#delete_modal"
                                            onClick={() => setTaskToDelete(task.id)}
                                          >
                                            <i className="ti ti-trash me-1" />
                                            Delete
                                          </button>
                                        </li>
                                      </ul>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                      {/* table end */}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* End Content */}
        {/* Start Footer */}
        <CommonFooter />
        {/* End Footer */}
      </div>
      {/* ========================
              End Page Content
          ========================= */}
      <>
        {/* Add Todo */}
        <div className="modal fade" id="add_todo">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Add To Do</h5>
                <button
                  type="button"
                  className="btn-close btn-close-modal"
                  data-bs-dismiss="modal"
                  aria-label="Close"
                >
                  <i className="ti ti-circle-x-filled" />
                </button>
              </div>
              <form onSubmit={handleAddTask}>
                <div className="modal-body">
                  <div className="row">
                    <div className="col-12">
                      <div className="mb-3">
                        <label className="form-label">Title</label>
                        <input 
                          type="text" 
                          className="form-control"
                          value={newTask.title}
                          onChange={(e) => setNewTask({...newTask, title: e.target.value})}
                          required
                        />
                      </div>
                    </div>
                    <div className="col-6">
                      <div className="mb-3">
                        <label className="form-label">Status</label>
                        <select
                          className="form-control"
                          value={newTask.status}
                          onChange={(e) => setNewTask({...newTask, status: e.target.value})}
                        >
                          <option value="pending">Pending</option>
                          <option value="inprogress">In Progress</option>
                          <option value="completed">Completed</option>
                          <option value="on-hold">On Hold</option>
                        </select>
                      </div>
                    </div>
                    <div className="col-6">
                      <div className="mb-3">
                        <label className="form-label">Priority</label>
                        <select
                          className="form-control"
                          value={newTask.priority}
                          onChange={(e) => setNewTask({...newTask, priority: e.target.value})}
                        >
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                        </select>
                      </div>
                    </div>
                    <div className="col-6">
                      <div className="mb-3">
                        <label className="form-label">Created Date</label>
                        <div className=" w-auto input-group-flat">
                          <input
                            type="date"
                            className="form-control"
                            value={newTask.createdDate}
                            onChange={(e) => setNewTask({...newTask, createdDate: e.target.value})}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="col-6">
                      <div className="mb-3">
                        <label className="form-label">Due Date</label>
                        <div className=" w-auto input-group-flat">
                          <input
                            type="date"
                            className="form-control"
                            value={newTask.dueDate}
                            onChange={(e) => setNewTask({...newTask, dueDate: e.target.value})}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="col-lg-12">
                      <div className="mb-3">
                        <label className="form-label">Descriptions</label>
                        <textarea
                          className="form-control"
                          rows={4}
                          value={newTask.description}
                          onChange={(e) => setNewTask({...newTask, description: e.target.value})}
                        />
                      </div>
                    </div>
                    <div className="col-12">
                      <div>
                        <label className="form-label">Select Assignee</label>
                        <input
                          type="text"
                          className="form-control"
                          value={newTask.assignee}
                          onChange={(e) => setNewTask({...newTask, assignee: e.target.value})}
                          placeholder="Enter assignee name"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-outline-light me-2"
                    data-bs-dismiss="modal"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-1" />
                        Saving...
                      </>
                    ) : (
                      'Add To Do'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
        {/* Add Todo end */}
        
        {/* Edit Todo */}
        <div className="modal fade" id="edit_todo">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Edit To Do</h5>
                <button
                  type="button"
                  className="btn-close btn-close-modal"
                  data-bs-dismiss="modal"
                  aria-label="Close"
                >
                  <i className="ti ti-circle-x-filled" />
                </button>
              </div>
              <form >
                <div className="modal-body">
                  <div className="row">
                    <div className="col-12">
                      <div className="mb-3">
                        <label className="form-label">Title</label>
                        <input
                          type="text"
                          className="form-control"
                          defaultValue="Update calendar and schedule"
                        />
                      </div>
                    </div>
                    <div className="col-6">
                      <div className="mb-3">
                        <label className="form-label">Status</label>
                        <select className="form-control">
                          <option value="pending">Pending</option>
                          <option value="inprogress" selected>In Progress</option>
                          <option value="completed">Completed</option>
                          <option value="on-hold">On Hold</option>
                        </select>
                      </div>
                    </div>
                    <div className="col-6">
                      <div className="mb-3">
                        <label className="form-label">Priority</label>
                        <select className="form-control">
                          <option value="low">Low</option>
                          <option value="medium" selected>Medium</option>
                          <option value="high">High</option>
                        </select>
                      </div>
                    </div>
                    <div className="col-6">
                      <div className="mb-3">
                        <label className="form-label">Created Date</label>
                        <div className=" w-auto input-group-flat">
                          <input type="date" className="form-control" />
                        </div>
                      </div>
                    </div>
                    <div className="col-6">
                      <div className="mb-3">
                        <label className="form-label">Due Date</label>
                        <div className=" w-auto input-group-flat">
                          <input type="date" className="form-control" />
                        </div>
                      </div>
                    </div>
                    <div className="col-lg-12">
                      <div className="mb-3">
                        <label className="form-label">Descriptions</label>
                        <textarea className="form-control" rows={4} />
                      </div>
                    </div>
                    <div className="col-12">
                      <div>
                        <label className="form-label">Select Assignee</label>
                        <input type="text" className="form-control" placeholder="Enter assignee name" />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-outline-light me-2"
                    data-bs-dismiss="modal"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
        {/* Edit Todo end */}
        
        {/* Delete Modal */}
        <div className="modal fade" id="delete_modal">
          <div className="modal-dialog modal-dialog-centered modal-sm">
            <div className="modal-content">
              <div className="modal-body text-center">
                <div className="mb-2">
                  <span className="avatar avatar-md rounded-circle bg-danger">
                    <i className="ti ti-trash fs-24" />
                  </span>
                </div>
                <h6 className="fs-16 mb-1">Confirm Deletion</h6>
                <p className="mb-3">
                  Are you sure you want to delete this task from LeadDash?
                </p>
                <div className="d-flex justify-content-center gap-2">
                  <button
                    className="btn btn-outline-light w-100"
                    data-bs-dismiss="modal"
                    disabled={deleteLoading}
                  >
                    Cancel
                  </button>
                  <button 
                    className="btn btn-danger w-100"
                    onClick={handleDeleteTask}
                    disabled={deleteLoading}
                  >
                    {deleteLoading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-1" />
                        Deleting...
                      </>
                    ) : (
                      'Yes, Delete'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* End Modal  */}
      </>

      <style>{`
        .spin {
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </>
  );
};

export default Todo;