// Tweetable Mathematical Art
// @rank 14
// @votes 54
// @title Because unicorns
// @author Martin Ender
// @url https://codegolf.stackexchange.com/a/35600
// @license CC BY-SA 3.0
// @read u8
//
// The three function bodies below are Martin Ender's answer, unchanged (written for the first
// revision of the template, hence char and red_fn / green_fn / blue_fn). The answer's heading
// is "Because unicorns."; the title here drops the full stop. Everything outside the three
// functions belongs to this repository.
#define TWEET_T unsigned char
#include "tweet.h"
char green_fn(int,int);
char blue_fn(int,int);

char red_fn(int i,int j){
    return (char)(_sq(cos(atan2(j-512,i-512)/2))*255);
}
char green_fn(int i,int j){
    return (char)(_sq(cos(atan2(j-512,i-512)/2-2*acos(-1)/3))*255);
}
char blue_fn(int i,int j){
    return (char)(_sq(cos(atan2(j-512,i-512)/2+2*acos(-1)/3))*255);
}

TWEET_MAIN(red_fn, green_fn, blue_fn)
