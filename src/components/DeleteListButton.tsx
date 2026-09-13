"use client";

import { deleteListAction } from "@/app/lists/actions";

export function DeleteListButton({ listId, name }: { listId: string; name: string }) {
  return (
    <form
      action={deleteListAction.bind(null, listId)}
      onSubmit={(event) => {
        if (!confirm(`Delete the list “${name}”?`)) event.preventDefault();
      }}
    >
      <button type="submit" className="text-sm text-red-300 hover:text-red-200">
        Delete list
      </button>
    </form>
  );
}
