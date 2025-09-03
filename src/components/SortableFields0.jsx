
// src/components/admin/SortableFields.jsx
// Improved: no external margins on items (uses internal padding), vertical-only drag.
// Fixes jumpy layout when dragging due to margins/gaps on sortable items.

import React, { useMemo } from "react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragOverlay,
  closestCenter
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";

export default function SortableFields({
  items,
  setItems,
  row,
  getId = (item, idx) => String(item?.id ?? item?.key ?? item?.name ?? idx),
  overlay = true,
  showDefaultHandle = false,   // domyślnie wyłączony, bo uchwyt renderujemy w wierszu na początku
  handlePosition = "left",
  handleClassName = ""
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const ids = useMemo(() => items.map(getId), [items, getId]);
  const [activeId, setActiveId] = React.useState(null);

  function handleDragStart(event) {
    setActiveId(event.active.id);
  }

  function handleDragEnd(event) {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) return;
    const oldIndex = ids.indexOf(active.id);
    const newIndex = ids.indexOf(over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const next = arrayMove(items, oldIndex, newIndex);
    setItems(next);
  }

  function handleDragCancel() {
    setActiveId(null);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {items.map((item, index) => (
          <SortableRow
            key={getId(item, index)}
            id={getId(item, index)}
            showDefaultHandle={showDefaultHandle}
            handlePosition={handlePosition}
            handleClassName={handleClassName}
          >
            {(handleProps, isDragging) => (
              <div
                className={[
                  // CONTENT WRAPPER — styl dla wizualnego kafla wiersza
                  "rounded-xl border border-neutral-700/40 bg-neutral-900/40",
                  "transition-shadow duration-150",
                  isDragging ? "shadow-lg ring-1 ring-blue-500/50" : "hover:shadow-sm"
                ].join(" ")}
              >
                {row(item, index, handleProps, isDragging)}
              </div>
            )}
          </SortableRow>
        ))}
      </SortableContext>

      {overlay && (
        <DragOverlay>
          {activeId ? (
            <div className="pointer-events-none select-none rounded-xl border border-neutral-700/40 bg-neutral-900/70 p-2 shadow-xl">
              <div className="text-sm text-neutral-300">Przenoszenie wiersza…</div>
            </div>
          ) : null}
        </DragOverlay>
      )}
    </DndContext>
  );
}

function SortableRow({
  id,
  children,
  showDefaultHandle = false,
  handlePosition = "left",
  handleClassName = ""
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id });

  // IMPORTANT: no external margins here; spacing achieved via paddingBottom,
  // so dnd-kit measures item height correctly and doesn't "jump".
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    paddingBottom: 8   // distance between items (instead of margin)
  };

  const handleProps = {
    ...attributes,
    ...listeners,
    className: "cursor-grab active:cursor-grabbing touch-none",
    title: "Przeciągnij, aby zmienić kolejność"
  };

  const HandleBtn = () => (
    <button
      {...handleProps}
      className={[
        "h-8 w-8 grid place-items-center rounded-md border border-neutral-700/40",
        "bg-neutral-800 hover:bg-neutral-700",
        "mr-3",
        handleClassName
      ].join(" ")}
      aria-label="Przeciągnij wiersz"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    </button>
  );

  return (
    <div ref={setNodeRef} style={style}>
      <div className="flex items-start">
        {showDefaultHandle && handlePosition === "left" ? <HandleBtn /> : null}
        <div className="flex-1">
          {children(handleProps, isDragging)}
        </div>
        {showDefaultHandle && handlePosition === "right" ? <HandleBtn /> : null}
      </div>
    </div>
  );
}
