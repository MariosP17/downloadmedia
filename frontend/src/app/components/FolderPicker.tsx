"use client";

import React, { useState ,useEffect} from 'react';
import Tree from 'rc-tree';
import 'rc-tree/assets/index.css'; // Required for default expanding/collapsing styles
import { toast } from 'react-hot-toast';

// Define the shape of your folder data
interface TreeNode {
  key: string;
  title: string;
  isLeaf?: boolean;
  children?: TreeNode[];
}

interface FolderPickerProps {
  style?: React.CSSProperties;
  initialFolder: string;
  onSelectFolder?: (folderId: string) => void;
  folderName?: string;
}

export default function FolderPicker({ style,initialFolder, onSelectFolder, folderName }: FolderPickerProps) {
  // 1. Initial state: Just the root folder. isLeaf: false tells rc-tree it has children to load.
  const [treeData, setTreeData] = useState<TreeNode[]>([{
    key: "/",
    title: "/",
    isLeaf: false
  }]);
  
  const [selectedFolder, setSelectedFolder] = useState<string | null>();
  const [displayedFolder, setDisplayedFolder] = useState<string | null>(initialFolder);
  const [treeOpen, setTreeOpen] = useState(false);
  // 2. The function to fetch subfolders from your remote API
  const fetchSubFolders = async (parentKey: string): Promise<TreeNode[]> => {
    try {
      const response = await fetch(`http://${window.location.hostname}:7000/getSuperFolderInfo`,{
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path: parentKey }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to fetch subfolders");
      
      // Map the API response to TreeNode format
      return data.folders.map((folder: { key: string; title: string; isLeaf: boolean }) => ({
        key: folder.key,
        title: folder.title,
        isLeaf: folder.isLeaf
      }));
    } catch (error) {
      console.error("Error fetching subfolders:", error);
      toast.error("Error fetching subfolders: " + (error instanceof Error ? error.message : ""));
      return [];
    }
  };

  // 3. Helper to update the tree state immutably when new data arrives
  const updateTreeData = (list: TreeNode[], key: React.Key, children: TreeNode[]): TreeNode[] => {
    return list.map((node) => {
      if (node.key === key) {
        return { ...node, children };
      }
      if (node.children) {
        return { ...node, children: updateTreeData(node.children, key, children) };
      }
      return node;
    });
  };

  // 4. Triggered when the user clicks the expand arrow
  const onLoadData = async (treeNode: any) => {
    const { key, children } = treeNode;
    
    // If children are already loaded, do nothing
    if (children) return;

    try {
      // Fetch children from server
      const newFolders = await fetchSubFolders(key);
      // Update state to render the new folders
      setTreeData((origin) => updateTreeData(origin, key, newFolders));
    } catch (error) {
      console.error("Failed to load folders", error);
    }
  };

  // 5. Triggered when the user clicks the folder name
  const onSelect = (selectedKeys: React.Key[], info: any) => {
    if (selectedKeys.length > 0) {
      if (selectedKeys[0] === "/") {
        selectedKeys = [];
        toast.error("Please select a valid folder, not the root folder.");
      }
      const folderId = selectedKeys[0] as string;
      setSelectedFolder(folderId);
      // if (onSelectFolder) {
      //   onSelectFolder(selectedKeys[0] as string);
      // }
      // setTreeOpen(false); // Close the modal after selection
    }
  };
  
  const onOpenTreeModal = () => {
    setTreeOpen(true);
  };

  const onCloseTreeModal = (save: boolean = false) => {
    if (save){
      if (onSelectFolder && selectedFolder && selectedFolder !== initialFolder) {
        onSelectFolder(selectedFolder);
      }
    }
    setTreeOpen(false);
  };

  useEffect(() => {
    setDisplayedFolder(initialFolder);
  }, [initialFolder]);

  return (
    <div>
    <div style={style} className='cursor-pointer'>
      <input type="text" value={displayedFolder || ''} readOnly placeholder="Select a folder" className="w-full mb-2 p-2 border rounded"
        onClick={onOpenTreeModal} />
    </div>
    {treeOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => onCloseTreeModal()}>
			<div className="flex max-h-[75vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl p-4 border border-zinc-800 bg-zinc-900 shadow-2xl" onClick={(event) => event.stopPropagation()}>
				<div className="flex items-center justify-between border-b border-zinc-800 p-3">
          <h2 className="text-lg font-semibold text-zinc-100">Select {folderName}</h2>
          <button
            onClick={() => onCloseTreeModal()}
            className="text-zinc-400 hover:text-white font-bold cursor-pointer text-sm"
          >
            ✕
          </button>
        </div>
        <div className="flex-grow overflow-auto p-4 search-scrollbar border-b border-zinc-800 p-3">
        <Tree
          treeData={treeData}
          loadData={onLoadData}
          onSelect={onSelect}
          selectedKeys={selectedFolder ? [selectedFolder] : []}
        />
        </div>
        <div className="flex justify-end p-3">
          <button
            onClick={() => onCloseTreeModal(true)}
            disabled={!selectedFolder || selectedFolder === initialFolder}
            className="bg-blue-700 cursor-pointer enabled:hover:bg-blue-900 text-white font-bold py-1 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Choose
          </button>
        </div>
      </div>
    </div>
    )}
    </div>
  );
}