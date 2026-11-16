// Buddhabrot (pieces/9a_buddhabrot.cpp) on several cores.
//
// The piece computes everything inside the first call of RD: for m = 1..4095 and n = 1..4095 it
// calls BL(m-4096, n-4096), and each of those calls only adds +1 or -1 to cells of GR's table.
// This program makes the same calls to the same BL for its share of the m values and then writes
// GR's table. The tables of all shares add up to the table the piece ends with (the increments
// are whole numbers, so their order does not matter); 9a_split.py adds them and writes the bytes
// the piece itself would print.
//
//   9a_split <share> <shares>        e.g. "0 3", "1 3" and "2 3" for three cores
#define TWEET_MAIN(R, G, B)
#include "../pieces/9a_buddhabrot.cpp"

int main(int argc, char** argv){
    tweet_guard();
    int w = atoi(argv[1]), W = atoi(argv[2]);
    // GR's table is the last static object (9a_split.py checks that with nm), so it ends where the
    // static data ends. It is reached through an address, not by name: read the cell as volatile,
    // or the compiler assumes that GR's writes cannot change what this pointer sees.
    uintptr_t end = (uintptr_t)&_end;
    volatile float* last = (volatile float*)(end - sizeof(float));
    GR(-2, -1);                           // the piece's own way of adding 1 to c[1023][1023] ...
    if(*last != 1){ fprintf(stderr, "9a_split: GR's table is not where it is expected\n"); return 2; }
    GR(-3, -1);                           // ... and of taking it away again
    if(*last != 0){ fprintf(stderr, "9a_split: GR's table is not where it is expected\n"); return 2; }
    for(int m = 1; m < 4096; m++)
        if(m % W == w){
            for(int n = 1; n < 4096; n++) BL(m - 4096, n - 4096);
            fprintf(stderr, "%d\n", m);   // progress
        }
    fwrite((void*)(end - sizeof(float) * DIM * DIM), sizeof(float), DIM * DIM, stdout);
    return 0;
}
