const withProvider = (Provider: React.ComponentType<any>) => {
  return (Component: React.ComponentType<any>) => {
    return (props: any) => {
      return (
        <Provider>
          <Component {...props} />
        </Provider>
      );
    };
  };
};

export default withProvider;
