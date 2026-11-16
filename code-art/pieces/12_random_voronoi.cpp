// Tweetable Mathematical Art
// @rank 12
// @votes 60
// @title Random Voronoi diagram
// @author teh internets is made of catz
// @url https://codegolf.stackexchange.com/a/35784
// @license CC BY-SA 3.0
// @read le16
//
// The three function bodies below are the final version from the answer by
// "teh internets is made of catz", unchanged (the answer's heading is "Random Voronoi diagram
// generator anyone?"). Everything outside the three functions belongs to this repository.
//
// red_fn calls srand(time(0)) at every pixel. As long as the clock does not tick during the run,
// every pixel gets the same 64 points; when it ticks, the red diagram changes from that row on.
// TWEET_CLOCK holds the clock still for the whole run, at the moment the answer was posted
// (2014-08-05 19:12:04 UTC). The picture depends on the C library's rand(), so it has the look
// of the author's picture, not the same cells.
#define TWEET_T unsigned short
#define TWEET_CLOCK 1407265924
#include "tweet.h"
unsigned short green_fn(int,int);
unsigned short blue_fn(int,int);

unsigned short red_fn(int i, int j){
int t[64],k=0,l,e,d=2e7;srand(time(0));while(k<64){t[k]=rand()%DIM;if((e=_sq(i-t[k])+_sq(j-t[42&k++]))<d)d=e,l=k;}return t[l];
}

unsigned short green_fn(int i, int j){
static int t[64];int k=0,l,e,d=2e7;while(k<64){if(!t[k])t[k]=rand()%DIM;if((e=_sq(i-t[k])+_sq(j-t[42&k++]))<d)d=e,l=k;}return t[l];
}

unsigned short blue_fn(int i, int j){
static int t[64];int k=0,l,e,d=2e7;while(k<64){if(!t[k])t[k]=rand()%DIM;if((e=_sq(i-t[k])+_sq(j-t[42&k++]))<d)d=e,l=k;}return t[l];
}

TWEET_MAIN(red_fn, green_fn, blue_fn)
