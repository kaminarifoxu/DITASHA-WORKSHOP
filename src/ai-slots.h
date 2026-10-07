#ifndef DITASHA_AI_SLOTS_H
#define DITASHA_AI_SLOTS_H
/* Shared by AI and RSS workers; updater waits until every worker releases. */
static volatile LONG ai_pending=0;
static BOOL reserve_ai_slot(void){
    LONG current=InterlockedCompareExchange(&ai_pending,0,0);
    for(;;){
        if(current>=3)return FALSE;
        LONG observed=InterlockedCompareExchange(&ai_pending,current+1,current);
        if(observed==current)return TRUE;
        current=observed;
    }
}
static void release_ai_slot(void){InterlockedDecrement(&ai_pending);}
#endif
