import React, { createContext, useContext, useState, useMemo } from 'react';

interface TitlebarContextType {
  customTitle: string | null;
  setCustomTitle: (title: string | null) => void;
}

const TitlebarContext = createContext<TitlebarContextType>({
  customTitle: null,
  setCustomTitle: () => {},
});

export const TitlebarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [customTitle, setCustomTitle] = useState<string | null>(null);

  const value = useMemo(
    () => ({
      customTitle,
      setCustomTitle,
    }),
    [customTitle]
  );

  return <TitlebarContext.Provider value={value}>{children}</TitlebarContext.Provider>;
};

export const useTitlebar = () => {
  return useContext(TitlebarContext);
};
