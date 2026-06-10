// driver-app.jsx — driver surface controller inside iPhone frame
const { useState: useStateDA, useEffect: useEffectDA } = React;

function DriverApp() {
  const { youDriver, freight, applications, submitApplication, acceptTender, resetDraft, toast, t } = useStore();
  // derive the right starting screen from shared store so it survives surface switches
  const myApp = applications.find(a => a.you);
  const activeTender = freight.find(f => f.accepted === 'd-you' && f.status === 'assigned');
  const derived = youDriver ? (activeTender ? 'active' : 'home') : (myApp ? 'pending' : 'welcome');
  const [screen, setScreen] = useStateDA(derived);
  const [appId, setAppId] = useStateDA(myApp ? myApp.id : null);
  const [localTender, setLocalTender] = useStateDA(activeTender || null);
  const tender = localTender || activeTender;

  const approved = !!youDriver;

  const handleSubmit = () => {
    const id = submitApplication();
    setAppId(id);
    setScreen('pending');
    toast('Solicitud enviada a revisión', 'Application sent for review', 'info');
  };

  const handleAccept = (f) => {
    acceptTender(f.id, 'd-you');
    setLocalTender(f);
    setScreen('active');
    toast('Flete aceptado · navegando', 'Tender accepted · navigating', 'ok');
  };

  const handleComplete = () => {
    toast('Entrega confirmada', 'Delivery confirmed', 'ok');
    setLocalTender(null);
    setScreen('home');
  };

  let content;
  if (screen === 'welcome') content = <DriverWelcome onStart={() => { resetDraft(); setScreen('onboarding'); }} />;
  else if (screen === 'onboarding') content = <DriverOnboarding onSubmit={handleSubmit} onExit={() => setScreen('welcome')} />;
  else if (screen === 'pending') content = <DriverPending appId={appId} approved={approved} onGoLive={() => setScreen('home')} />;
  else if (screen === 'home') content = youDriver ? <DriverHome driver={youDriver} onAccept={handleAccept} /> : <DriverPending appId={appId} approved={false} />;
  else if (screen === 'active') content = youDriver ? <DriverActive driver={youDriver} tender={tender} onComplete={handleComplete} /> : <DriverWelcome onStart={() => { resetDraft(); setScreen('onboarding'); }} />;

  return (
    <IOSDevice width={390} height={844}>
      {content}
    </IOSDevice>
  );
}

Object.assign(window, { DriverApp });
