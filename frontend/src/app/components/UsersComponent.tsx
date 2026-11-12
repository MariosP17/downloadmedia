"use client";

import React, { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import ComponentLoader from "../componentLoader";
import { User, UsersOrigin } from "../../../Props";

interface UsersComponentProps {
    GetUsers: () => Promise<User[]>;
    DeleteUser: (id: string) => Promise<void>;
    AddUser: (username: string, password: string) => Promise<void>;
    origin : UsersOrigin;
}

export default function UsersComponent({ GetUsers, DeleteUser, AddUser, origin }: UsersComponentProps) {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [newUsername, setNewUsername] = useState<string>("");
    const [newPassword, setNewPassword] = useState<string>("");
    const [deleteModalOpen, setDeleteModalOpen] = useState<boolean>(false);
    const [userToDelete, setUserToDelete] = useState<User | null>(null);
    const [editModalOpen, setEditModalOpen] = useState<boolean>(false);
    const [userToEdit, setUserToEdit] = useState<User | null>(null);
    const [addingUserModal, setAddingUserModal] = useState<boolean>(false);


    useEffect(() => {
        const topbar = document.getElementById("top-bar");
        const documentScroll = document.documentElement.style.overflow;
        document.documentElement.style.overflow = "hidden"; // Prevent scrolling
        if (!topbar) {
            return;
        }
        const topbardisplay = topbar.style.display;
        topbar.style.display = "none";

        fetchUsers();
        
        return () => {
            if (topbar) {
                topbar.style.display = topbardisplay;
            }
            document.documentElement.style.overflow = documentScroll; // Restore scrolling
        };
    }, []);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const fetchedUsers = await GetUsers();
            setUsers(fetchedUsers);
        } catch (error) {
            console.error("Error fetching users:", error);
            toast.error("Failed to fetch users.");
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteUser = async (id: string) => {
        try {
            await DeleteUser(id);
            toast.success(`User ${id} deleted successfully.`);
            fetchUsers(); // Refresh the user list
        } catch (error) {
            console.error(`Error deleting user ${id}:`, error);
            toast.error(`Failed to delete user ${id}.`);
        }
    };

    const handleAddUser = async () => {
        if (!newUsername || !newPassword) {
            toast.error("Username and password cannot be empty.");
            return;
        }
        await AddUser(newUsername, newPassword);
        await fetchUsers(); // Refresh the user list
        setNewUsername("");
        setNewPassword("");
        setAddingUserModal(false);
    };

    return (
        <div className="p-4">
            <h2 className="text-xl font-bold mb-4">Users</h2>
            {loading ? (
                <ComponentLoader />
            ) : (
                <div>
                    <table className="min-w-full border border-gray-300">
                        <thead>
                            <tr>
                                <th className="py-2 px-4 border-b">Type</th>
                                <th className="py-2 px-4 border-b">Username</th>
                                {origin != UsersOrigin.Jellyfin && <th className="py-2 px-4 border-b">Name</th>}
                                <th className="py-2 px-4 border-b">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map((user) => (
                                <tr key={user.id}>
                                    <td className="py-2 px-4 border-b text-center">{user.type}</td>
                                    <td className="py-2 px-4 border-b text-center">{user.username}</td>
                                    {origin != UsersOrigin.Jellyfin && <td className="py-2 px-4 border-b text-center">{user.name}</td>}
                                    <td className="py-2 px-4 gap-2 flex border-b items-center justify-center">
                                        <button
                                            onClick={() =>{ setUserToEdit(user);  setEditModalOpen(true)}}
                                            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-2 rounded cursor-pointer"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={() =>{ setUserToDelete(user);  setDeleteModalOpen(true)}}
                                            className="bg-red-500 hover:bg-red-700 text-white font-bold py-1 px-2 rounded cursor-pointer"
                                        >
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {!addingUserModal && (
                    <div className="mt-4 flex justify-end items-center">
                        <button
                            onClick={ () => setAddingUserModal(true)}
                            className="bg-green-500 hover:bg-green-700 text-white font-bold py-1 px-2 rounded cursor-pointer"
                        >
                            Add User
                        </button>
                    </div>
                    )}
                </div>
            )}
            {deleteModalOpen && userToDelete && (
            <div onClick={() => setDeleteModalOpen(false)} className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                <div onClick={(e) => e.stopPropagation()} className="bg-zinc-900 border border-zinc-800 w-full max-w-md rounded-xl p-5 flex flex-col shadow-2xl">
                    <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-4">
                    <label className="block text-sm font-bold text-zinc-400 tracking-wider">Confirm Deletion</label>
                    <button 
                        onClick={() => setDeleteModalOpen(false)}
                        className="text-zinc-400 hover:text-white font-bold cursor-pointer text-sm"
                    >
                        ✕
                    </button>
                    </div>
                    <div className="mb-4">
                    <span className="block text-sm font-bold text-zinc-400 tracking-wider mb-1">Are you sure you want to delete user {userToDelete.username}?</span>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                    <button 
                        onClick={(e) => {
                        setDeleteModalOpen(false);
                        handleDeleteUser(userToDelete.id);
                        }} 
                        className="px-3 py-1.5 bg-red-600 hover:bg-red-500 rounded-lg text-sm font-medium text-white transition-colors cursor-pointer"
                    >
                        Delete
                    </button>
                    <button 
                        onClick={() => setDeleteModalOpen(false)} 
                        className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                    >
                        Cancel
                    </button>
                    </div>
                </div>
            </div>
        )}
        {addingUserModal && (
            <div onClick={() => setAddingUserModal(false)} className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                <div onClick={(e) => e.stopPropagation()} className="bg-zinc-900 border border-zinc-800 w-full max-w-md rounded-xl p-5 flex flex-col shadow-2xl">
                    <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-4">
                    <label className="block text-sm font-bold text-zinc-400 tracking-wider">Add New User</label>
                    <button 
                        onClick={() => setAddingUserModal(false)}
                        className="text-zinc-400 hover:text-white font-bold cursor-pointer text-sm"
                    >
                        ✕
                    </button>
                    </div>
                    <div className="mb-4">
                        <label className="block text-sm font-bold text-zinc-400 tracking-wider mb-1">Username</label>
                        <input 
                            type="text"
                            value={newUsername}
                            onChange={(e) => setNewUsername(e.target.value)}
                            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div className="mb-4">
                        <label className="block text-sm font-bold text-zinc-400 tracking-wider mb-1">Password</label>
                        <input 
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                    <button 
                        onClick={(e) => {
                        setAddingUserModal(false);
                        handleAddUser();
                        }} 
                        className="px-3 py-1.5 bg-green-600 hover:bg-green-500 rounded-lg text-sm font-medium text-white transition-colors cursor-pointer"
                    >
                        Add User
                    </button>
                    <button 
                        onClick={() => setAddingUserModal(false)} 
                        className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                    >
                        Cancel
                    </button>
                    </div>
                </div>
            </div>
        )}
        {editModalOpen && userToEdit && (
            <div onClick={() => setEditModalOpen(false)} className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                <div onClick={(e) => e.stopPropagation()} className="bg-zinc-900 border border-zinc-800 w-full max-w-md rounded-xl p-5 flex flex-col shadow-2xl">
                    <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-4">
                    <label className="block text-sm font-bold text-zinc-400 tracking-wider">Edit User</label>
                    <button 
                        onClick={() => setEditModalOpen(false)}
                        className="text-zinc-400 hover:text-white font-bold cursor-pointer text-sm"
                    >
                        ✕
                    </button>
                    </div>
                    <div className="mb-4">
                        <label className="block text-sm font-bold text-zinc-400 tracking-wider mb-1">Username</label>
                        <input 
                            type="text"
                            value={userToEdit.username}
                            onChange={(e) => setUserToEdit({ ...userToEdit, username: e.target.value })}
                            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <label className="block text-sm font-bold text-zinc-400 tracking-wider mb-1 mt-4">Password</label>
                        <input 
                            type="password"
                            value={""}
                            onChange={(e) => setUserToEdit({ ...userToEdit, password: e.target.value })}
                            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                    <button 
                        onClick={() => {
                            // Implement the logic to save the edited user details
                            setEditModalOpen(false);
                        }} 
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium text-white transition-colors cursor-pointer"
                    >
                        Save Changes
                    </button>
                    <button 
                        onClick={() => setEditModalOpen(false)} 
                        className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                    >
                        Cancel
                    </button>
                    </div>
                </div>
            </div>
        )}
        </div>
    );
}