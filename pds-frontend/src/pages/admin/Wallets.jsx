import { useEffect } from 'react';
import { Wallet } from 'lucide-react';
import PanelHeader from '../../design/primitives/PanelHeader';
import EmptyState from '../../design/primitives/EmptyState';

const Wallets = () => {
    useEffect(() => { document.title = 'Wallets — PDS Supervision'; }, []);

    return (
        <>
            <PanelHeader
                title="Wallets"
                subtitle="Wallet balances are shown on each beneficiary's record until a dedicated wallet ledger view exists."
            />
            <EmptyState
                icon={<Wallet size={20} />}
                title="No standalone wallet view yet"
                description="Wallet balances (rice, wheat, sugar) currently live on each ration card and beneficiary record. A dedicated ledger view will appear here once one exists."
            />
        </>
    );
};

export default Wallets;
