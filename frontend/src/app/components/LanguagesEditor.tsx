"use client"

import { useState, useEffect } from "react";
import Loader from "../loader";
import toast from "react-hot-toast";

type LanguagesEditorProps = {
  languages: { name: string; code: string,id: number }[];
};

type LanguageEntryProps = {
    language: { name: string; code: string,id: number };
    add?: boolean;
    cancelAdd?: () => void;
    afterAdd?: () => void;
    afterDelete?: () => void;
};

function LanguageEntry({ language, add = false, cancelAdd, afterAdd, afterDelete }: LanguageEntryProps) {
    const [isEditing, setIsEditing] = useState(add || false);
    const [originalLanguage, setOriginalLanguage] = useState({ ...language });
    const [loading, setLoading] = useState(false);
    const [Language, setLanguage] = useState({ ...language });

    const handleSaveEditLanguage = async (updatedLanguage: { name: string; code: string,id: number }) => {
        
        try{
        setLoading(true);
        const res = await fetch(`http://${window.location.hostname}:7000/updateLanguage`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(updatedLanguage),
        });
        const result = await res.json();
        if (!result.success) throw new Error(result.message || "Failed to update language");
        setOriginalLanguage({ ...updatedLanguage });
        setLanguage({ ...updatedLanguage });
        setIsEditing(false);
        } catch (error) {
            console.error("Error saving language:", error);
            toast.error("Failed to save language. " + (error instanceof Error ? error.message : ""));
        } finally {
            setLoading(false);
        }
    };

    const handleSaveAddLanguage = async (newLanguage: { name: string; code: string,id: number }) => {
        try{
        setLoading(true);
        const res = await fetch(`http://${window.location.hostname}:7000/addLanguage`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ "name": newLanguage.name, "code": newLanguage.code }),
        });
        const result = await res.json();
        if (!result.success) throw new Error(result.message || "Failed to add language");
        setOriginalLanguage({ ...newLanguage });
        setLanguage({ ...newLanguage });
        setIsEditing(false);
        if (afterAdd) afterAdd();
        } catch (error) {
            console.error("Error adding language:", error);
            toast.error("Failed to add language. " + (error instanceof Error ? error.message : ""));
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteLanguage = async (languageToDelete: { name: string; code: string,id: number }) => {
        try{
        setLoading(true);
        const res = await fetch(`http://${window.location.hostname}:7000/deleteLanguage`, {
            method: "DELETE",
             body: new URLSearchParams({ id: languageToDelete.id.toString() }),
        });
        const result = await res.json();
        if (!result.success) throw new Error(result.message || "Failed to delete language");
        if (afterDelete) afterDelete();
        } catch (error) {
            console.error("Error deleting language:", error);
            toast.error("Failed to delete language. " + (error instanceof Error ? error.message : ""));
        } finally {
            setLoading(false);
        }
    };

    const handleChangeMode = (add: boolean) => {
        if (add) {
            if (cancelAdd) cancelAdd();
        } else {
            setIsEditing(false);
            setLanguage({ ...originalLanguage });
        }
    };

        return (
        <div >
        {isEditing && (
            <div className="flex items-center justify-between bg-zinc-800 rounded px-2 py-1">
            <div className="flex items-center bg-zinc-800 rounded px-2 py-1">
                <input
                    type="text"
                    placeholder="Language Name"
                    value={Language.name}
                    className="bg-zinc-900 w-auto border border-zinc-700 rounded px-2 py-1 text-zinc-200 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-zinc-500 focus:border-zinc-500 transition-colors [color-scheme:dark]"
                    onChange={(e) => {
                        setLanguage({ ...Language, name: e.target.value });
                    }}
                />
                <input
                    type="text"
                    placeholder="Language Code"
                    value={Language.code}
                    className="bg-zinc-900 w-auto border border-zinc-700 rounded px-2 py-1 text-zinc-200 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-zinc-500 focus:border-zinc-500 transition-colors [color-scheme:dark]"
                    onChange={(e) => {
                        setLanguage({ ...Language, code: e.target.value });
                    }}
                />
                </div>
                <div className="flex gap-2">
                    <button onClick={() =>handleChangeMode(add)} className="cursor-pointer text-red-500 hover:text-red-400">
                        ✕
                    </button>
                    <button
                        disabled={Language.name.trim() === "" || Language.code.trim() === "" || Language.name.trim().length >20 || Language.code.trim().length >4}
                        onClick={() => {
                            if (!add){
                                handleSaveEditLanguage(Language);
                            }
                            else{
                                handleSaveAddLanguage(Language);
                            }
                        }}
                        className="disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-green-500 hover:opacity-80"
                    >
                        <img src="/save.svg" alt="Save" className="w-5 h-5" />
                    </button>
                </div>
                </div>
                )
        }

        {!isEditing && (
        <div className="flex items-center justify-between bg-zinc-800 rounded px-2 py-1">
            <span>{Language.name} ({Language.code})</span>
            <div className="flex gap-2">
                <button
                    onClick={() => {
                        setIsEditing(true);
                    }}
                    className="cursor-pointer text-blue-500 hover:opacity-80"
                >
                    <img src="/edit.png" alt="Edit" className="w-5 h-5" />
                </button>
                <button
                    onClick={() => {
                        handleDeleteLanguage(Language);
                    }}
                    className="cursor-pointer text-red-500 hover:opacity-80"
                >
                    <img src="/delete.png" alt="Remove" className="w-5 h-5" />
                </button>
            </div>
        </div>
        )
        }
        {loading && <Loader/>}
        </div>
    );
}

export function LanguagesEditor({ languages }: LanguagesEditorProps) {
const [Languages, setLanguages] = useState<{ name: string; code: string,id: number }[]>(languages);
const [openEditor, setOpenEditor] = useState(false);
const [isAdding, setIsAdding] = useState(false);
//   useEffect(() => {
//     const fetchLanguages = async () => {
//       try {
//         const res = await fetch(`http://${window.location.hostname}:7000/getLanguages`);
//         const data = await res.json();
//         if (data.success === false) throw new Error(data.message || "Failed to fetch languages");
//         setLanguages(data.data || []);
//       } catch (error) {
//         console.error("Error fetching languages:", error);
//       }
//     };

//     void fetchLanguages();
//   }, []);
    useEffect(() => {
        setLanguages(languages);
    }, [languages]);

    useEffect(() => {
        if (!openEditor) {
            return;
        }
        const bodyoverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = bodyoverflow;
        };
    }, [openEditor]);

    const closeEditor = () => {
        setOpenEditor(false);
        setIsAdding(false);
    }

    const handleAfterAdd = () => {
        setIsAdding(false);
        // Refresh the languages list after adding a new language
        const fetchLanguages = async () => {
            try {
                const res = await fetch(`http://${window.location.hostname}:7000/getLanguages`);
                const data = await res.json();
                if (data.success === false) throw new Error(data.message || "Failed to fetch languages");
                setLanguages(data.data || []);
            } catch (error) {
                console.error("Error fetching languages:", error);
            }
        };
        void fetchLanguages();
    };
    
    const handleAfterDelete = () => {
        // Refresh the languages list after deleting a language
        const fetchLanguages = async () => {
            try {
                const res = await fetch(`http://${window.location.hostname}:7000/getLanguages`);
                const data = await res.json();
                if (data.success === false) throw new Error(data.message || "Failed to fetch languages");
                setLanguages(data.data || []);
            } catch (error) {
                console.error("Error fetching languages:", error);
            }
        };
        void fetchLanguages();
    }

  return (
    <div>
    <div onClick={() => setOpenEditor(true)} className="w-auto items-center justify-center cursor-pointer border border-zinc-700 rounded-md p-2 max-h-48 overflow-y-auto bg-zinc-900 text-zinc-200 text-xs font-medium flex gap-2">
        {Languages.length === 0 && <p className="text-zinc-400 text-sm">No languages available</p>}
        {Languages.map((language) => (
            <div key={language.code} className="flex items-center bg-zinc-800 rounded px-2 py-1">
                <span>{language.name}</span>
            </div>
        ))}
    </div>
    {openEditor && (
        <div onClick={closeEditor} className="fixed inset-0 bg-black/80 flex items-center justify-center z-60">
            <div onClick={(e) =>{ e.preventDefault(); e.stopPropagation();}} className="bg-zinc-900  p-4 rounded-md w-126 max-h-[80vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Languages Editor</h2>
                <button onClick={closeEditor} className="cursor-pointer hover:text-red-400">
                        ✕
                </button>
                </div>
                
                <p className="text-sm text-zinc-400 mb-1">Existing Languages</p>
                <div className="flex flex-col gap-2 mb-2">
                    {Languages.map((language) => (
                        <LanguageEntry key={language.code} language={language} afterDelete={handleAfterDelete} />
                    ))}
                    {isAdding && <LanguageEntry language={{ name: "", code: "", id: 0 }} add={true} cancelAdd={() => setIsAdding(false)} afterAdd={handleAfterAdd} />}
                </div>
                <div className="flex justify-end">
                <button hidden={isAdding} onClick={() => setIsAdding(true)} className="cursor-pointer bg-blue-700 hover:bg-blue-900 text-white py-1 px-2 rounded">
                    Add Language
                </button>
                </div>
            </div>
        </div>
    )}
    </div>  
  );
}
