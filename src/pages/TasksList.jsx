/**
 * TasksList.jsx — Filtered task list page.
 * Sets store filters based on URL params, then renders TaskTable.
 */

import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import useStore from '../store';
import TaskTable from '../components/TaskTable/TaskTable';
import Modal from '../components/Modal/Modal';

export default function TasksList({ onNewOp }) {
  const { filterType, filterValue } = useParams();
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [editTask, setEditTask]   = useState(null);

  const setFilter = useStore(s => s.setFilter);
  const fetchTasks = useStore(s => s.fetchTasks);
  const selectTask = useStore(s => s.selectTask);

  useEffect(() => {
    let f = {};
    if (filterType === 'in-progress') f.status = 'in_progress';
    else if (filterType === 'standby')   f.status = 'standby';
    else if (filterType === 'completed') f.status = 'completed';
    else if (filterType === 'overdue')   f.status = 'overdue';
    else if (filterType === 'division')  f.division = filterValue;
    setFilter(f, { push: false });
    fetchTasks(f);
  }, [filterType, filterValue]);

  const handleNewOp = () => { setEditTask(null); setShowModal(true); };
  const handleEdit   = (opId) => { navigate(`/tasks/${opId}`); };
  const handleTaskSelect = (opId) => selectTask(opId);

  return (
    <>
      <TaskTable onTaskSelect={handleTaskSelect} />
      {showModal && (
        <Modal
          task={editTask}
          onClose={() => { setShowModal(false); setEditTask(null); }}
        />
      )}
    </>
  );
}
