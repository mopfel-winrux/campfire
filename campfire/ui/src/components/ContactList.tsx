import React from "react";
import { Contact } from "../hooks/useContacts";

interface Props {
  contacts: Map<string, Contact>;
  onCall: (ship: string) => void;
}

export default function ContactList({ contacts, onCall }: Props) {
  if (contacts.size === 0) return null;

  return (
    <div className="w-full">
      <p className="text-xs text-stone-500 uppercase tracking-wider mb-2 pl-1">
        Contacts
      </p>
      <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
        {Array.from(contacts.entries()).map(([ship, contact]) => (
          <button
            key={ship}
            onClick={() => onCall(ship)}
            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-stone-800/60 transition-colors text-left group"
          >
            {contact.avatar ? (
              <img
                src={contact.avatar}
                className="w-7 h-7 rounded-full object-cover"
                alt=""
              />
            ) : (
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-mono text-stone-300"
                style={{ backgroundColor: contact.color || "#555" }}
              >
                ~{ship}
              </div>
            )}
            <div className="flex flex-col min-w-0">
              {contact.nickname && (
                <span className="text-sm text-stone-200 truncate">
                  {contact.nickname}
                </span>
              )}
              <span className="text-xs text-stone-500 font-mono truncate">
                ~{ship}
              </span>
            </div>
            <span className="ml-auto text-stone-700 group-hover:text-amber-500 transition-colors text-sm">
              Call
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
