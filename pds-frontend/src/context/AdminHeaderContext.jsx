import { createContext, useContext, useEffect, useState } from 'react';

// Split into a stable setter context and a value context so pages that only call
// usePageHeader (via the setter) never re-render when the header value itself changes —
// only AdminTopBar (the value consumer) does.
const AdminHeaderValueContext = createContext({ title: '', actions: [] });
const AdminHeaderSetterContext = createContext(null);

export const AdminHeaderProvider = ({ children }) => {
  const [header, setHeader] = useState({ title: '', actions: [] });

  return (
    <AdminHeaderSetterContext.Provider value={setHeader}>
      <AdminHeaderValueContext.Provider value={header}>{children}</AdminHeaderValueContext.Provider>
    </AdminHeaderSetterContext.Provider>
  );
};

export const useAdminHeaderValue = () => useContext(AdminHeaderValueContext);

// Registers this page's title + primary action(s) with the persistent AdminLayout top bar.
// actions: [{ key, label, icon: LucideComponent, onClick, variant }]
export const usePageHeader = (title, actions = []) => {
  const setHeader = useContext(AdminHeaderSetterContext);

  useEffect(() => {
    setHeader({ title, actions });
    return () => setHeader({ title: '', actions: [] });
  }, [title, actions, setHeader]);
};
