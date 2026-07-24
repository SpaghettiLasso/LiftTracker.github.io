const STORAGE_KEY = "lift-tracker-data-v3";

const groupForm = document.getElementById("group-form");
const exerciseForm = document.getElementById("exercise-form");
const groupList = document.getElementById("group-list");
const groupSummary = document.getElementById("group-summary");
const exerciseGroupSelect = document.getElementById("exercise-group");

let groups = loadGroups();
let editingGroupId = null;
let editingExerciseId = null;
let draggedExerciseId = null;

groupForm.addEventListener("submit", handleGroupSubmit);
exerciseForm.addEventListener("submit", handleExerciseSubmit);
groupList.addEventListener("click", handleGroupListClick);
groupList.addEventListener("submit", handleGroupListSubmit);
groupList.addEventListener("dragstart", handleDragStart);
groupList.addEventListener("dragover", handleDragOver);
groupList.addEventListener("drop", handleDrop);

groupList.addEventListener("touchstart", handleTouchStart, { passive: true });
groupList.addEventListener("touchend", handleTouchEnd);

render();

function handleGroupSubmit(event) {
  event.preventDefault();
  const formData = new FormData(groupForm);
  const name = formData.get("name").toString().trim();

  if (!name) {
    return;
  }

  if (editingGroupId) {
    groups = groups.map((group) => (group.id === editingGroupId ? { ...group, name } : group));
  } else {
    groups = [{ id: crypto.randomUUID(), name, exercises: [] }, ...groups];
  }

  editingGroupId = null;
  groupForm.reset();
  saveGroups();
  render();
}

function handleExerciseSubmit(event) {
  event.preventDefault();
  const formData = new FormData(exerciseForm);
  const name = formData.get("name").toString().trim();
  const groupId = formData.get("groupId").toString();
  const repMin = Number(formData.get("repMin"));
  const repMax = Number(formData.get("repMax"));
  const repsCompleted = Number(formData.get("repsCompleted"));
  const weight = Number(formData.get("weight"));

  if (!name || !groupId) {
    return;
  }

  const now = new Date().toISOString();
  const exerciseEntry = {
    id: crypto.randomUUID(),
    name,
    repMin,
    repMax,
    repsCompleted,
    weight,
    lastUpdated: now,
    history: [{ date: now, repMin, repMax, repsCompleted, weight }],
  };

  if (editingExerciseId) {
    groups = groups.map((group) => {
      if (group.id !== groupId) {
        return group;
      }

      return {
        ...group,
        exercises: group.exercises.map((exercise) => {
          if (exercise.id !== editingExerciseId) {
            return exercise;
          }

          return {
            ...exercise,
            name,
            repMin,
            repMax,
            repsCompleted,
            weight,
            lastUpdated: now,
            history: [
              ...exercise.history,
              {
                date: now,
                repMin,
                repMax,
                repsCompleted,
                weight,
              },
            ],
          };
        }),
      };
    });
  } else {
    groups = groups.map((group) => (group.id === groupId ? { ...group, exercises: [exerciseEntry, ...group.exercises] } : group));
  }

  editingExerciseId = null;
  exerciseForm.reset();
  document.getElementById("rep-min").value = 6;
  document.getElementById("rep-max").value = 8;
  document.getElementById("reps-completed").value = 7;
  document.getElementById("weight").value = 60;
  saveGroups();
  render();
}

function render() {
  groupSummary.textContent = `${groups.length} ${groups.length === 1 ? "group" : "groups"}`;

  const groupOptions = groups.length
    ? groups
        .map((group) => `<option value="${group.id}" ${group.id === getDefaultGroupId() ? "selected" : ""}>${escapeHtml(group.name)}</option>`)
        .join("")
    : '<option value="">Create a group first</option>';
  exerciseGroupSelect.innerHTML = groupOptions;

  if (!groups.length) {
    groupList.innerHTML = '<p class="empty-state">Create a group and add exercises to it.</p>';
    return;
  }

  groupList.innerHTML = groups
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((group) => {
      const groupExercises = group.exercises.slice().sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated));
      return `
        <article class="group-card" data-group-id="${group.id}">
          <header>
            <strong>${escapeHtml(group.name)}</strong>
            <div class="form-actions">
              <button class="edit-btn" data-action="edit-group" data-id="${group.id}" type="button">Edit group</button>
              <button class="delete-btn" data-action="delete-group" data-id="${group.id}" type="button">Delete group</button>
            </div>
          </header>
          <div class="exercise-list">
            ${groupExercises.length ? groupExercises.map((exercise) => renderExerciseCard(exercise)).join("") : '<p class="empty-state">No exercises yet in this group.</p>'}
          </div>
        </article>
      `;
    })
    .join("");
}

function renderExerciseCard(exercise) {
  if (editingExerciseId === exercise.id) {
    return `
      <article class="exercise-card" draggable="true" data-exercise-id="${exercise.id}">
        <form class="edit-form" data-id="${exercise.id}">
          <label>
            Exercise name
            <input name="name" type="text" value="${escapeHtml(exercise.name)}" required />
          </label>
          <div class="row">
            <label>
              Target min reps
              <input name="repMin" type="number" min="1" value="${exercise.repMin}" required />
            </label>
            <label>
              Target max reps
              <input name="repMax" type="number" min="1" value="${exercise.repMax}" required />
            </label>
          </div>
          <div class="row">
            <label>
              Reps completed
              <input name="repsCompleted" type="number" min="0" value="${exercise.repsCompleted}" required />
            </label>
            <label>
              Weight (kg)
              <input name="weight" type="number" min="0" step="0.5" value="${exercise.weight}" required />
            </label>
          </div>
          <div class="form-actions">
            <button class="save-btn" type="submit">Save changes</button>
            <button class="cancel-btn" type="button" data-action="cancel-edit">Cancel</button>
          </div>
        </form>
      </article>
    `;
  }

  return `
    <article class="exercise-card" draggable="true" data-exercise-id="${exercise.id}">
      <header>
        <div>
          <strong>${escapeHtml(exercise.name)}</strong>
          <div class="meta">Last updated ${formatDate(exercise.lastUpdated)}</div>
        </div>
        <div class="form-actions">
          <button class="edit-btn" data-action="edit-exercise" data-id="${exercise.id}" type="button">Edit</button>
          <button class="delete-btn" data-action="delete-exercise" data-id="${exercise.id}" type="button">Delete</button>
        </div>
      </header>
      <div class="meta">Target: ${exercise.repMin}-${exercise.repMax} reps</div>
      <div class="meta">Current: ${exercise.repsCompleted} reps at ${exercise.weight.toFixed(1)} kg</div>
    </article>
  `;
}

function handleGroupListClick(event) {
  const button = event.target.closest("button");
  if (!button) {
    return;
  }

  const action = button.dataset.action;
  const id = button.dataset.id;

  if (action === "delete-group") {
    groups = groups.filter((group) => group.id !== id);
    editingGroupId = null;
    saveGroups();
    render();
  }

  if (action === "edit-group") {
    const group = groups.find((entry) => entry.id === id);
    if (group) {
      editingGroupId = id;
      groupForm.elements.name.value = group.name;
      render();
    }
  }

  if (action === "delete-exercise") {
    groups = groups.map((group) => ({ ...group, exercises: group.exercises.filter((exercise) => exercise.id !== id) }));
    editingExerciseId = null;
    saveGroups();
    render();
  }

  if (action === "edit-exercise") {
    editingExerciseId = id;
    render();
  }

  if (action === "cancel-edit") {
    editingExerciseId = null;
    render();
  }
}

function handleGroupListSubmit(event) {
  const form = event.target.closest(".edit-form");
  if (!form) {
    return;
  }

  event.preventDefault();
  const formData = new FormData(form);
  const name = formData.get("name").toString().trim();
  const repMin = Number(formData.get("repMin"));
  const repMax = Number(formData.get("repMax"));
  const repsCompleted = Number(formData.get("repsCompleted"));
  const weight = Number(formData.get("weight"));

  if (!name) {
    return;
  }

  const now = new Date().toISOString();
  groups = groups.map((group) => ({
    ...group,
    exercises: group.exercises.map((exercise) => {
      if (exercise.id !== form.dataset.id) {
        return exercise;
      }

      return {
        ...exercise,
        name,
        repMin,
        repMax,
        repsCompleted,
        weight,
        lastUpdated: now,
        history: [
          ...exercise.history,
          {
            date: now,
            repMin,
            repMax,
            repsCompleted,
            weight,
          },
        ],
      };
    }),
  }));

  editingExerciseId = null;
  saveGroups();
  render();
}

function handleDragStart(event) {
  const exerciseCard = event.target.closest("[data-exercise-id]");
  if (!exerciseCard) {
    return;
  }

  draggedExerciseId = exerciseCard.dataset.exerciseId;
  event.dataTransfer?.setData("text/plain", draggedExerciseId);
}

function handleDragOver(event) {
  if (!draggedExerciseId) {
    return;
  }

  const dropTarget = event.target.closest(".group-card");
  if (!dropTarget) {
    return;
  }

  event.preventDefault();
}

function handleDrop(event) {
  const dropTarget = event.target.closest(".group-card");
  if (!dropTarget || !draggedExerciseId) {
    return;
  }

  event.preventDefault();
  const targetGroupId = dropTarget.dataset.groupId;
  moveExerciseToGroup(draggedExerciseId, targetGroupId);
  draggedExerciseId = null;
}

function handleTouchStart(event) {
  const exerciseCard = event.target.closest("[data-exercise-id]");
  if (!exerciseCard) {
    return;
  }

  draggedExerciseId = exerciseCard.dataset.exerciseId;
}

function handleTouchEnd(event) {
  const dropTarget = event.target.closest(".group-card");
  if (!dropTarget || !draggedExerciseId) {
    return;
  }

  const targetGroupId = dropTarget.dataset.groupId;
  moveExerciseToGroup(draggedExerciseId, targetGroupId);
  draggedExerciseId = null;
}

function moveExerciseToGroup(exerciseId, targetGroupId) {
  const currentExercise = groups.flatMap((group) => group.exercises).find((exercise) => exercise.id === exerciseId);
  if (!currentExercise || !targetGroupId) {
    return;
  }

  groups = groups.map((group) => {
    const isSourceGroup = group.exercises.some((exercise) => exercise.id === exerciseId);
    const isTargetGroup = group.id === targetGroupId;

    if (isSourceGroup) {
      return { ...group, exercises: group.exercises.filter((exercise) => exercise.id !== exerciseId) };
    }

    if (isTargetGroup) {
      return { ...group, exercises: [currentExercise, ...group.exercises] };
    }

    return group;
  });

  saveGroups();
  render();
}

function saveGroups() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
}

function loadGroups() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function getDefaultGroupId() {
  return groups[0]?.id || "";
}

function formatDate(value) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
